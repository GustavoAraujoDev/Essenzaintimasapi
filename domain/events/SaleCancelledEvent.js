
"use strict";

class SaleCancelledEvent {
  constructor({ venda, contexto }) {
    this.eventName = "SALE_CANCELLED";
    this.payload = {
      venda,
      contexto: contexto || {},
    };
    this.occurredAt = new Date();
  }
}

module.exports = SaleCancelledEvent;
