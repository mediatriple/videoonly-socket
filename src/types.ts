export interface TextareaChangePayload {
  user_id: string;
  encoders_id: string;
  value: string;
  user_name: string;
}

export interface EncoderActionButtonPayload {
  user_id: string;
  encoders_id: string;
  value: string | number;
}

export interface PreviewNormalSoundWarningPayload {
  user_id: string;
  encoders_id: string;
  is_mismatch: boolean;
  sound_scope: 'normal' | 'preview';
}

export interface SocketSoundPayload {
  user_id: string;
  encoders_id: string;
  value: number;
  sound_scope: 'normal' | 'preview';
}

export interface EncoderIconButtonPayload {
  user_id: string;
  encoders_id: string;
  value: boolean | number;
}

export interface EncoderLogoButtonPayload {
  user_id: string;
  encoders_id: string;
  value: boolean | number;
}

export interface EncoderKjControlButtonPayload {
  user_id: string;
  encoders_id: string;
  value: boolean | number;
}

export interface AuthenticatedSocket {
  user_id: string;
  encoders_id: string;
}
