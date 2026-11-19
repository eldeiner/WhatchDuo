import { describe, expect, it } from 'vitest';
import {
  createRoomSchema,
  detectUnsupportedVideoPage,
  detectVideoType,
  isAllowedVideoUrl,
  joinRoomPayloadSchema,
  nicknameSchema,
  parseVideoSource,
  rateCommandSchema,
  roomCodeSchema,
  videoEmbedUrl,
  videoUrlError,
  videoUrlSchema,
} from '../src';

describe('roomCodeSchema', () => {
  it('normaliza a mayúsculas y acepta el alfabeto permitido', () => {
    expect(roomCodeSchema.parse('abc234')).toBe('ABC234');
  });

  it('rechaza códigos con caracteres ambiguos o longitud incorrecta', () => {
    expect(roomCodeSchema.safeParse('ABCI0O').success).toBe(false);
    expect(roomCodeSchema.safeParse('ABC').success).toBe(false);
  });
});

describe('nicknameSchema', () => {
  it('acepta letras unicode, números y separadores', () => {
    expect(nicknameSchema.parse('  Ana-María_2 ')).toBe('Ana-María_2');
    expect(nicknameSchema.parse('Ñoño 99')).toBe('Ñoño 99');
  });

  it('rechaza apodos demasiado cortos o con símbolos raros', () => {
    expect(nicknameSchema.safeParse('A').success).toBe(false);
    expect(nicknameSchema.safeParse('<script>').success).toBe(false);
    expect(nicknameSchema.safeParse('a'.repeat(25)).success).toBe(false);
  });
});

describe('videoUrlSchema helper', () => {
  it('acepta http(s) y rutas relativas', () => {
    expect(isAllowedVideoUrl('https://cdn.example.com/movie.m3u8')).toBe(true);
    expect(isAllowedVideoUrl('http://localhost:3000/a.mp4')).toBe(true);
    expect(isAllowedVideoUrl('/videos/demo.mp4')).toBe(true);
  });

  it('rechaza protocolos peligrosos y rutas de red', () => {
    expect(isAllowedVideoUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedVideoUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedVideoUrl('//evil.example.com/a.mp4')).toBe(false);
    expect(isAllowedVideoUrl('')).toBe(false);
  });

  it('detecta el tipo de video por extensión', () => {
    expect(detectVideoType('https://x.dev/a.M3U8?token=1')).toBe('hls');
    expect(detectVideoType('https://x.dev/a.webm')).toBe('webm');
    expect(detectVideoType('https://x.dev/a.mp4')).toBe('mp4');
    expect(detectVideoType('/videos/demo.mp4')).toBe('mp4');
  });

  it('reconoce los formatos de enlace de YouTube', () => {
    const id = 'aqz-KE-bpKQ';
    expect(parseVideoSource(`https://www.youtube.com/watch?v=${id}&t=10`)).toEqual({
      type: 'youtube',
      videoId: id,
    });
    expect(parseVideoSource(`https://youtu.be/${id}?si=abc`)).toEqual({
      type: 'youtube',
      videoId: id,
    });
    expect(parseVideoSource(`https://www.youtube.com/shorts/${id}`)).toEqual({
      type: 'youtube',
      videoId: id,
    });
    expect(parseVideoSource(`https://m.youtube.com/watch?v=${id}`)).toEqual({
      type: 'youtube',
      videoId: id,
    });
    expect(detectVideoType(`https://youtu.be/${id}`)).toBe('youtube');
    expect(videoEmbedUrl({ type: 'youtube', videoId: id })).toBe(
      `https://www.youtube-nocookie.com/embed/${id}`,
    );
  });

  it('reconoce enlaces de Vimeo, incluidos los no listados', () => {
    expect(parseVideoSource('https://vimeo.com/76979871')).toEqual({
      type: 'vimeo',
      videoId: '76979871',
    });
    expect(parseVideoSource('https://player.vimeo.com/video/76979871?h=abc123')).toEqual({
      type: 'vimeo',
      videoId: '76979871',
      hash: 'abc123',
    });
    expect(detectVideoType('https://vimeo.com/76979871')).toBe('vimeo');
    expect(videoEmbedUrl({ type: 'vimeo', videoId: '76979871', hash: 'abc123' })).toContain(
      '/video/76979871?',
    );
  });

  it('acepta YouTube/Vimeo y rechaza plataformas con DRM', () => {
    expect(videoUrlSchema.safeParse('https://youtu.be/aqz-KE-bpKQ').success).toBe(true);
    expect(videoUrlSchema.safeParse('https://vimeo.com/76979871').success).toBe(true);
    expect(videoUrlError('https://www.youtube.com/watch?v=corto')).toContain('YouTube');
    expect(videoUrlError('https://www.netflix.com/watch/123')).toContain('DRM');
    expect(detectUnsupportedVideoPage('https://www.netflix.com/watch/123')).toBe('Netflix');
    expect(detectUnsupportedVideoPage('https://youtu.be/aqz-KE-bpKQ')).toBeNull();
    expect(detectUnsupportedVideoPage('https://cdn.example.com/movie.mp4')).toBeNull();
    expect(videoUrlError('https://cdn.example.com/movie.mp4')).toBeNull();
  });
});

describe('createRoomSchema', () => {
  it('acepta solo apodo', () => {
    expect(createRoomSchema.parse({ nickname: 'Ana' })).toEqual({ nickname: 'Ana' });
  });

  it('rechaza URL inválida', () => {
    expect(createRoomSchema.safeParse({ nickname: 'Ana', videoUrl: 'ftp://x/a.mp4' }).success).toBe(
      false,
    );
  });
});

describe('eventos', () => {
  it('valida payloads de join', () => {
    expect(joinRoomPayloadSchema.safeParse({ code: 'ABC234' }).success).toBe(true);
    expect(joinRoomPayloadSchema.safeParse({ code: 'abc234' }).success).toBe(true);
    expect(joinRoomPayloadSchema.safeParse({ code: '!!!!!!' }).success).toBe(false);
  });

  it('rechaza velocidades no soportadas', () => {
    expect(rateCommandSchema.safeParse({ rate: 1.25, clientSeq: 1 }).success).toBe(true);
    expect(rateCommandSchema.safeParse({ rate: 2, clientSeq: 1 }).success).toBe(false);
  });
});
