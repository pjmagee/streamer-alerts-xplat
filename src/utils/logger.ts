import winston from 'winston';
import path from 'path';
import { app } from 'electron';

// Create logs directory path
const getLogPath = () => {
  try {
    // Use app.getPath for proper user data directory
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'logs');
  } catch (error) {
    // Fallback for cases where app might not be available
    return path.join(process.cwd(), 'logs');
  }
};

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: 'debug',
  format: customFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File transport for persistent logging
    new winston.transports.File({
      filename: path.join(getLogPath(), 'app.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      format: customFormat
    }),
    // Error-only file transport
    new winston.transports.File({
      filename: path.join(getLogPath(), 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
      format: customFormat
    })
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(getLogPath(), 'exceptions.log'),
      format: customFormat
    })
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(getLogPath(), 'rejections.log'),
      format: customFormat
    })
  ]
});

export default logger;
