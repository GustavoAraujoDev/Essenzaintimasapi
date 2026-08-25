const validateRequest = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(422).json({
      message: "Dados inválidos",
      // ✅ Corrigido para 'details' e adicionado '?.' por segurança
      errors: error.details?.map((d) => d.message) || [error.message],
    });
  }

  req.body = value;
  next();
};

module.exports = validateRequest;
