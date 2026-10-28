import {
  IDeliveryRepository,
  Delivery,
} from "../interfaces/delivery.repository.js";
import { IOrderRepository } from "../interfaces/order.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import { RecordDeliveryInput } from "../validators/delivery.validator.js";
import { NotFoundError } from "../errors/index.js";
import { OrderStatus } from "@loompilot/shared";

export type DeliveryTrigger = (tenantId: string, delivery: Delivery) => Promise<void>;

export class DeliveryService {
  private deliveryTrigger: DeliveryTrigger | null = null;

  constructor(
    private readonly deliveryRepo: IDeliveryRepository,
    private readonly orderRepo: IOrderRepository,
    private readonly uow: IUnitOfWork,
    private readonly audit?: IAuditLogRepository
  ) {}

  registerDeliveryTrigger(trigger: DeliveryTrigger): void {
    this.deliveryTrigger = trigger;
  }

  async list(actor: Actor, query?: ListQuery): Promise<Page<Delivery>> {
    return this.deliveryRepo.list(actor.tenantId, query);
  }

  async getById(actor: Actor, id: string): Promise<Delivery> {
    const delivery = await this.deliveryRepo.findById(actor.tenantId, id);
    if (!delivery) {
      throw new NotFoundError(`Delivery with ID ${id} not found`);
    }
    return delivery;
  }

  async recordDelivery(
    actor: Actor,
    input: RecordDeliveryInput
  ): Promise<Delivery> {
    const delivery = await this.uow.run(async (tx) => {
      const order = await this.orderRepo.findById(actor.tenantId, input.orderId, tx);
      if (!order) {
        throw new NotFoundError(`Order with ID ${input.orderId} not found`);
      }

      const deliveryDateStr = input.deliveryDate || new Date().toISOString().split("T")[0]!;
      const isOnTime = deliveryDateStr <= order.targetDeliveryDate;

      const createdDelivery = await this.deliveryRepo.create(
        {
          tenantId: actor.tenantId,
          orderId: input.orderId,
          customerId: input.customerId,
          deliveredQuantity: input.deliveredQuantity,
          deliveryDate: deliveryDateStr,
          totalInvoicePaise: input.totalInvoicePaise,
          isOnTime,
          receivedBy: input.receivedBy,
          notes: input.notes,
        },
        tx
      );

      // Update production order status to COMPLETED and set actual delivery date
      await this.orderRepo.updateStatus(
        actor.tenantId,
        order.id,
        OrderStatus.COMPLETED,
        deliveryDateStr,
        tx
      );

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            userRole: actor.role,
            action: "DELIVERY_RECORDED",
            entity: "delivery",
            entityId: createdDelivery.id,
            changes: {
              deliveryNumber: createdDelivery.deliveryNumber,
              invoiceNumber: createdDelivery.invoiceNumber,
              totalInvoicePaise: createdDelivery.totalInvoicePaise,
            },
          },
          tx
        );
      }

      return createdDelivery;
    });

    // Amendment 2: Event-triggered payment follow-up creation immediately upon delivery
    if (this.deliveryTrigger) {
      this.deliveryTrigger(actor.tenantId, delivery).catch(() => {});
    }

    return delivery;
  }
}

