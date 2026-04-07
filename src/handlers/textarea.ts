import { Server, Socket } from 'socket.io';
import { TextareaChangePayload } from '../types';
import { logger } from '../logger';

export function registerHandlers(_io: Server, socket: Socket): void {
  socket.on('textarea-change', (payload: TextareaChangePayload) => {
    const { user_id, encoders_id, value, user_name } = payload;

    logger.info(
      { event: 'textarea-change', user_id, encoders_id, socket_id: socket.id },
      'textarea-change received',
    );

    socket
      .to(`encoder:${encoders_id}`)
      .emit('textarea-update', { user_id, encoders_id, value, user_name });
  });
}
