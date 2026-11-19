import { describe, expect, it } from 'vitest';
import { unpackPacker } from '../src/services/mediaExtractor';

describe('unpackPacker', () => {
  it('desempaqueta correctamente código JS ofuscado con Dean Edwards Packer', () => {
    // Ejemplo canónico de Dean Edwards Packer con un m3u8 escondido
    const packed = `eval(function(p,a,c,k,e,d){e=function(c){return c.toString(36)};if(!''.replace(/^/,String)){while(c--){d[c.toString(a)]=k[c]||c.toString(a)}k=[function(e){return d[e]}];e=function(){return'\\\\w+'};c=1};while(c--){if(k[c]){p=p.replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c])}}return p}('4 1="2://0.3/5/6.7";',8,8,'example|streamUrl|https|com|var|hls|master|m3u8'.split('|')))`;

    const unpacked = unpackPacker(packed);
    expect(unpacked).toBeTruthy();
    expect(unpacked).toContain('https://example.com/hls/master.m3u8');
  });

  it('devuelve null si no es un script empaquetado', () => {
    const normalCode = 'var a = 123; console.log(a);';
    expect(unpackPacker(normalCode)).toBeNull();
  });
});
