import { Router } from "express";
import { WebhookController } from "../controllers/webhook.controller.js";

export const webhookRouter: Router = Router();
const controller = new WebhookController();

webhookRouter.post("/razorpay", controller.handleRazorpayWebhook);
