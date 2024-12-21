const validateRequestUpdate = (req, res, next) => {
    const schema = Joi.object({
      status: Joi.string().valid('pending', 'approved', 'rejected').required(),
      feedback: Joi.string().optional(),
    });
  
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);
  
    next();
  };
  