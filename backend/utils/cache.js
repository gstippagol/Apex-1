const { createClient } = require('redis');
const logger = require('./logger');

let client;
let isConnected = false;

const initRedis = async () => {
    if (process.env.REDIS_URL) {
        client = createClient({ url: process.env.REDIS_URL });
        
        client.on('error', (err) => {
            logger.error('Redis Client Error', err);
            isConnected = false;
        });

        try {
            await client.connect();
            logger.info('Connected to Redis successfully');
            isConnected = true;
        } catch (err) {
            logger.error('Could not connect to Redis', err);
            isConnected = false;
        }
    }
};

initRedis();

/**
 * Cache wrapper
 * @param {string} key 
 * @param {number} ttl In seconds
 * @param {function} fetchFn Function to fetch data if not in cache
 */
const cache = async (key, ttl, fetchFn) => {
    if (!isConnected) {
        return await fetchFn();
    }

    try {
        const cachedValue = await client.get(key);
        if (cachedValue) {
            return JSON.parse(cachedValue);
        }

        const freshData = await fetchFn();
        await client.setEx(key, ttl, JSON.stringify(freshData));
        return freshData;
    } catch (err) {
        logger.error(`Cache error for key ${key}:`, err);
        return await fetchFn();
    }
};

const invalidate = async (pattern) => {
    if (!isConnected) return;
    try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(keys);
            logger.info(`Invalidated cache for pattern: ${pattern}`);
        }
    } catch (err) {
        logger.error(`Invalidate error for pattern ${pattern}:`, err);
    }
};

module.exports = { cache, invalidate };
