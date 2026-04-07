import { Server, Socket } from 'socket.io';
import {
  EncoderActionButtonPayload,
  EncoderIconButtonPayload,
  EncoderKjControlButtonPayload,
  EncoderLogoButtonPayload,
} from '../types';
import { logger } from '../logger';

export function registerHandlers(_io: Server, socket: Socket): void {
  socket.on('encoder_action_button', (payload: EncoderActionButtonPayload) => {
    const { user_id, encoders_id, value } = payload;

    logger.info(
      {
        event: 'encoder_action_button',
        user_id,
        encoders_id,
        socket_id: socket.id,
      },
      'encoder_action_button received',
    );

    socket
      .to(`encoder:${encoders_id}`)
      .emit('socket_encoder_action_buttonton_update', {
        user_id,
        encoders_id,
        value,
      });
  });

  socket.on('encoder_icon_button', (payload: EncoderIconButtonPayload) => {
    const { user_id, encoders_id, value } = payload;

    logger.info(
      {
        event: 'encoder_icon_button',
        user_id,
        encoders_id,
        socket_id: socket.id,
      },
      'encoder_icon_button received',
    );

    socket
      .to(`encoder:${encoders_id}`)
      .emit('icon-status-update', { user_id, encoders_id, value });
  });

  socket.on('encoder_logo_button', (payload: EncoderLogoButtonPayload) => {
    const { user_id, encoders_id, value } = payload;

    logger.info(
      {
        event: 'encoder_logo_button',
        user_id,
        encoders_id,
        socket_id: socket.id,
      },
      'encoder_logo_button received',
    );

    socket
      .to(`encoder:${encoders_id}`)
      .emit('logo-status-update', { user_id, encoders_id, value });
  });

  socket.on(
    'encoder_kj_control_button',
    (payload: EncoderKjControlButtonPayload) => {
      const { user_id, encoders_id, value } = payload;

      logger.info(
        {
          event: 'encoder_kj_control_button',
          user_id,
          encoders_id,
          socket_id: socket.id,
        },
        'encoder_kj_control_button received',
      );

      socket
        .to(`encoder:${encoders_id}`)
        .emit('kj-control-status-update', { user_id, encoders_id, value });
    },
  );
}
