const cors = require('cors');
const express = require('express');

// CORS configuration
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
};

// Middleware setup
const setupMiddleware = (app) => {
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.static('public'));
};

module.exports = {
  setupMiddleware
};
