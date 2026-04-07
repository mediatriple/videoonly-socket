import { Server, Socket } from 'socket.io';
import {
  PreviewNormalSoundWarningPayload,
  SocketSoundPayload,
} from '../types';
import { logger } from '../logger';

export function registerHandlers(_io: Server, socket: Socket): void {
  socket.on(
    'preview_normal_sound_warning',
    (payload: PreviewNormalSoundWarningPayload) => {
      const { user_id, encoders_id, is_mismatch, sound_scope } = payload;

      logger.info(
        {
          event: 'preview_normal_sound_warning',
          user_id,
          encoders_id,
          socket_id: socket.id,
        },
        'preview_normal_sound_warning received',
      );

      socket
        .to(`encoder:${encoders_id}`)
        .emit('preview_normal_sound_warning_update', {
          user_id,
          encoders_id,
          is_mismatch,
          sound_scope,
        });
    },
  );

  socket.on('socket_sound_right', (payload: SocketSoundPayload) => {
    const { user_id, encoders_id, value, sound_scope } = payload;

    logger.info(
      {
        event: 'socket_sound_right',
        user_id,
        encoders_id,
        socket_id: socket.id,
      },
      'socket_sound_right received',
    );

    socket
      .to(`encoder:${encoders_id}`)
      .emit('socket_sound_right_update', {
        user_id,
        encoders_id,
        value,
        sound_scope,
      });
  });

  socket.on('socket_sound_left', (payload: SocketSoundPayload) => {
    const { user_id, encoders_id, value, sound_scope } = payload;

    logger.info(
      {
        event: 'socket_sound_left',
        user_id,
        encoders_id,
        socket_id: socket.id,
      },
      'socket_sound_left received',
    );

    socket
      .to(`encoder:${encoders_id}`)
      .emit('socket_sound_left_update', {
        user_id,
        encoders_id,
        value,
        sound_scope,
      });
  });
}
