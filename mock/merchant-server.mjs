import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { startMerchant } from './merchant.mjs';
startMerchant();
