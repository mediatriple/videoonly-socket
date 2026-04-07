import pino from 'pino';

const usePretty =
  process.env.NODE_ENV === 'development' &&
  (() => {
    try {
      require.resolve('pino-pretty');
      return true;
    } catch {
      return false;
    }
  })();

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'panelsocket' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(usePretty && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});
