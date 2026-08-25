/**
 * @file app-test.js
 * @description 
 *
 * @module app-test
 * @author Seu Nome
 * @since 2025
 */

const express = require("express");
const productRoutes = require("./interfaces/http/routes/product-routes");
const { swaggerUi, swaggerSpec } = require('./swagger');

const app = express();
app.use(express.json());
app.use("/products", productRoutes);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

module.exports = app;
