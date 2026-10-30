import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IReservation extends BaseEntity {
  orderId: Types.ObjectId;
  materialId: Types.ObjectId;
  qty: number;
  status: "active" | "released" | "consumed";
}

const ReservationSchema = new Schema<IReservation>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
    qty: { type: Number, required: true },
    status: {
      type: String,
      enum: ["active", "released", "consumed"],
      default: "active",
      required: true,
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ReservationSchema.index({ tenantId: 1, orderId: 1, materialId: 1 }, { unique: true });

export const ReservationModel =
  mongoose.models.Reservation || mongoose.model<IReservation>("Reservation", ReservationSchema);
