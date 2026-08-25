class EventDispatcher {
  constructor() {
    /**
     * {
     *   EVENT_NAME: [handler1, handler2]
     * }
     */
    this.handlers = {};
  }

  /**
   * Registra um handler para um evento
   */
  register(eventName, handler) {
    if (!this.handlers[eventName]) {
      this.handlers[eventName] = [];
    }

    this.handlers[eventName].push(handler);
  }

  /**
   * Dispara um evento de domínio
   */
  async dispatch(event) {
    const eventName = event.constructor.name;
    const handlers = this.handlers[eventName] || [];

    for (const handler of handlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        console.error('[EVENT_DISPATCH_ERROR]', {
          event: eventName,
          handler: handler.constructor.name,
          error: error.message
        });
      }
    }
  }

  /**
   * Dispara múltiplos eventos (padrão para Entities)
   */
  async dispatchAll(events = []) {
    for (const event of events) {
      await this.dispatch(event);
    }
  }
}

module.exports = EventDispatcher;
