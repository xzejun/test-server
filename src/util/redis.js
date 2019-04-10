import Redis from 'ioredis';
import cfg from '../cfg';

const { redis: options } = cfg;
const redis = new Redis(options);

export default redis;
