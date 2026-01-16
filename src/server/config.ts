import { config } from 'dotenv';

config();

export const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  isDev: process.env.NODE_ENV !== 'production',
};
