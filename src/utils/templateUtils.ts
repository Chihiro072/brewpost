// Template utility functions for applying logo and color palette to generated images

export interface TemplateSettings {
  logoPreview?: string;
  selectedPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  selectedColor?: string;
  companyText?: string;
  textColor?: string;
  textSize?: number;
  textPosition?: 'above' | 'below' | 'left' | 'right';
  textAlignment?: 'left' | 'center' | 'right';
}

export const getTemplateSettings = (): TemplateSettings | null => {
  try {
    const saved = localStorage.getItem('brewpost-template');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const enhanceImagePromptWithTemplate = (originalPrompt: string): string => {
  const template = getTemplateSettings();
  if (!template) return originalPrompt;

  let enhancedPrompt = originalPrompt;

  // Add color palette instruction
  if (template.selectedColor && template.selectedColor !== 'transparent') {
    enhancedPrompt += ` Use ${template.selectedColor} as the primary color theme and accent color throughout the image.`;
  }

  // Add logo space instruction
  if (template.logoPreview && template.selectedPosition) {
    const positionMap = {
      'top-left': 'top-left corner',
      'top-center': 'top center',
      'top-right': 'top-right corner',
      'bottom-left': 'bottom-left corner',
      'bottom-center': 'bottom center',
      'bottom-right': 'bottom-right corner'
    };
    
    enhancedPrompt += ` Leave space in the ${positionMap[template.selectedPosition]} for a logo overlay.`;
  }

  return enhancedPrompt;
};

export const applyTemplateToImage = async (imageUrl: string): Promise<string> => {
  const template = getTemplateSettings();
  // Return original URL if no meaningful template processing is needed
  if (!template || (!template.logoPreview && !template.companyText && (!template.selectedColor || template.selectedColor === 'transparent'))) {
    console.log('No template processing needed, returning original URL');
    return imageUrl;
  }
  
  // Also return original URL if only a color overlay with very low opacity would be applied
  if (!template.logoPreview && !template.companyText && template.selectedColor && template.selectedColor !== 'transparent') {
    console.log('Only color overlay would be applied, returning original URL to avoid base64 conversion');
    return imageUrl;
  }

  try {
    // Fetch image as blob to bypass CORS
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        resolve(imageUrl);
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the original image
      ctx.drawImage(img, 0, 0);
      
      // Apply color overlay if specified
      if (template.selectedColor && template.selectedColor !== 'transparent') {
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = template.selectedColor + '30';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      
      // Add logo and text if available
      if (template.logoPreview && template.selectedPosition) {
        const logo = new Image();
        
        logo.onload = () => {
          const logoSize = Math.min(canvas.width, canvas.height) * 0.12;
          const logoWidth = logoSize;
          const logoHeight = (logo.height / logo.width) * logoSize;
          
          let logoX = 0, logoY = 0;
          const padding = Math.max(20, canvas.width * 0.02);
          
          // Calculate logo position
          switch (template.selectedPosition) {
            case 'top-left':
              logoX = padding;
              logoY = padding;
              break;
            case 'top-center':
              logoX = (canvas.width - logoWidth) / 2;
              logoY = padding;
              break;
            case 'top-right':
              logoX = canvas.width - logoWidth - padding;
              logoY = padding;
              break;
            case 'bottom-left':
              logoX = padding;
              logoY = canvas.height - logoHeight - padding;
              break;
            case 'bottom-center':
              logoX = (canvas.width - logoWidth) / 2;
              logoY = canvas.height - logoHeight - padding;
              break;
            case 'bottom-right':
              logoX = canvas.width - logoWidth - padding;
              logoY = canvas.height - logoHeight - padding;
              break;
          }
          
          // Draw logo with shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
          
          // Reset shadow
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Add company text if available
          if (template.companyText) {
            const fontSize = (template.textSize || 24) * (canvas.width / 1000);
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            ctx.fillStyle = template.textColor || '#000000';
            ctx.textAlign = template.textAlignment || 'center';
            
            const textMetrics = ctx.measureText(template.companyText);
            const textWidth = textMetrics.width;
            const textHeight = fontSize;
            
            let textX = logoX + logoWidth / 2;
            let textY = logoY + logoHeight / 2;
            
            // Position text relative to logo
            switch (template.textPosition) {
              case 'above':
                textY = logoY - 10;
                break;
              case 'below':
                textY = logoY + logoHeight + textHeight + 10;
                break;
              case 'left':
                textX = logoX - 2;
                ctx.textAlign = 'right';
                textY = logoY + logoHeight / 2 + textHeight / 3;
                break;
              case 'right':
                textX = logoX + logoWidth + 2;
                ctx.textAlign = 'left';
                textY = logoY + logoHeight / 2 + textHeight / 3;
                break;
            }
            
            // Add text shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            ctx.fillText(template.companyText, textX, textY);
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
          
          try {
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            console.warn('Canvas tainted, returning original image');
            resolve(imageUrl);
          }
        };
        
        logo.onerror = () => {
          console.warn('Logo failed to load');
          try {
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            console.warn('Canvas tainted, returning original image');
            resolve(imageUrl);
          }
        };
        logo.src = template.logoPreview;
      } else if (template.companyText) {
        // Only text, no logo
        const fontSize = (template.textSize || 24) * (canvas.width / 1000);
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = template.textColor || '#000000';
        ctx.textAlign = 'center';
        
        const padding = Math.max(20, canvas.width * 0.02);
        let textX = canvas.width / 2;
        let textY = padding + fontSize;
        
        // Position text based on selected position
        switch (template.selectedPosition) {
          case 'top-left':
            ctx.textAlign = 'left';
            textX = padding;
            textY = padding + fontSize;
            break;
          case 'top-center':
            textX = canvas.width / 2;
            textY = padding + fontSize;
            break;
          case 'top-right':
            ctx.textAlign = 'right';
            textX = canvas.width - padding;
            textY = padding + fontSize;
            break;
          case 'bottom-left':
            ctx.textAlign = 'left';
            textX = padding;
            textY = canvas.height - padding;
            break;
          case 'bottom-center':
            textX = canvas.width / 2;
            textY = canvas.height - padding;
            break;
          case 'bottom-right':
            ctx.textAlign = 'right';
            textX = canvas.width - padding;
            textY = canvas.height - padding;
            break;
        }
        
        // Add text shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        ctx.fillText(template.companyText, textX, textY);
        
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          console.warn('Canvas tainted, returning original image');
          resolve(imageUrl);
        }
      } else {
        // No logo or text, but apply color overlay if specified
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          console.warn('Canvas tainted, returning original image');
          resolve(imageUrl);
        }
      }
    };
    
      img.onerror = () => {
        console.warn('Base image failed to load');
        URL.revokeObjectURL(blobUrl);
        resolve(imageUrl);
      };
      img.src = blobUrl;
    });
  } catch (error) {
    console.warn('Failed to fetch image:', error);
    return imageUrl;
  }
};

// Helper: shift hue of a hex color by degrees (returns hex)
const shiftHexHue = (hex: string, deg: number) => {
  try {
    const hsl = hexToHsl(hex);
    if (!hsl) return hex;
    let h = (hsl.h + deg) % 360;
    if (h < 0) h += 360;
    return hslToHex({ h, s: hsl.s, l: hsl.l });
  } catch (e) {
    return hex;
  }
};

// Convert hex to HSL
const hexToHsl = (hex: string) => {
  try {
    const cleaned = expandShortHex(hex).replace('#', '');
    const num = parseInt(cleaned, 16);
    const r = ((num >> 16) & 255) / 255;
    const g = ((num >> 8) & 255) / 255;
    const b = (num & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h = Math.round(h * 60);
    }
    return { h, s, l };
  } catch (e) { return null; }
};

// Convert HSL to hex
const hslToHex = ({ h, s, l }: { h: number; s: number; l: number }) => {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh >= 0 && hh < 1) { r = c; g = x; b = 0; }
  else if (hh >= 1 && hh < 2) { r = x; g = c; b = 0; }
  else if (hh >= 2 && hh < 3) { r = 0; g = c; b = x; }
  else if (hh >= 3 && hh < 4) { r = 0; g = x; b = c; }
  else if (hh >= 4 && hh < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const m = l - c / 2;
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Apply component overlays (promotion badges, trend glows) to the generated image
export const applyComponentsToImage = async (
  imageUrl: string,
  components: Array<{ id?: string; name?: string; title?: string; category?: string; color?: string; position?: { x: number; y: number } }>
): Promise<string> => {
  if (!components || components.length === 0) return imageUrl;
  try {
    const resp = await fetch(imageUrl);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageUrl);
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Find promotion component
        const promo = components.find(c => (c.category && String(c.category).toLowerCase().includes('promotion')) || (c.name && /%|off|discount|promo/i.test(String(c.name))));
        if (promo) {
          // Choose badge color:
          // - use promo.color if provided
          // - otherwise pick a random color from a friendly palette so badges aren't always blue
          let baseHex: string;
          if (promo.color && typeof promo.color === 'string') {
            const rawColor = promo.color;
            baseHex = rawColor.startsWith('#') ? expandShortHex(rawColor) : stringToDeterministicHex(String(rawColor));
          } else {
            const palette = ['#FFB86B', '#FF6B6B', '#6BCBFF', '#7C4DFF', '#4DD0E1', '#00C851', '#FF3B30', '#F06292', '#FFD54F', '#4DB6AC'];
            baseHex = palette[Math.floor(Math.random() * palette.length)];
          }
          // shift hue slightly to avoid exact overlap with template colors
          const badgeHex = shiftHexHue(baseHex, 12 + Math.floor(Math.random() * 20));

          // Badge size (inner/text size) and a larger visual circle size
          const badgeSize = Math.min(canvas.width, canvas.height) * 0.18;
          const circleBadgeSize = badgeSize * 1.25; // visual circle larger than inner/text area
          const padding = Math.max(12, canvas.width * 0.02);

          // Determine badge position: use explicit position if provided, else choose anchor based on template
          let centerX = canvas.width - padding - circleBadgeSize / 2;
          let centerY = padding + circleBadgeSize / 2; // default top-right

          const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

          // If promo provided a position, it can be a normalized pair, pixel pair, or a keyword string
          const maybePos: unknown = (promo as unknown as { position?: unknown }).position;
          let pos: { x?: number; y?: number } | string | undefined;
          if (maybePos && typeof maybePos === 'object' && ('x' in (maybePos as object) || 'y' in (maybePos as object))) {
            pos = maybePos as { x?: number; y?: number };
          } else if (typeof maybePos === 'string') {
            pos = maybePos as string;
          } else {
            pos = undefined;
          }
          if (pos && typeof pos === 'object' && typeof pos.x === 'number' && typeof pos.y === 'number') {
            const px = pos.x;
            const py = pos.y;
            if (px > 0 && px <= 1 && py > 0 && py <= 1) {
              centerX = px * canvas.width;
              centerY = py * canvas.height;
            } else {
              centerX = px;
              centerY = py;
            }
          } else if (typeof pos === 'string') {
            // keyword positions: center-left, center-right, center-up, center-down, center
            switch (pos) {
              case 'center-left':
                centerX = padding + circleBadgeSize / 2 + canvas.width * 0.02;
                centerY = canvas.height / 2;
                break;
              case 'center-right':
                centerX = canvas.width - padding - circleBadgeSize / 2 - canvas.width * 0.02;
                centerY = canvas.height / 2;
                break;
              case 'center-up':
                centerX = canvas.width / 2;
                centerY = padding + circleBadgeSize / 2 + canvas.height * 0.02;
                break;
              case 'center-down':
                centerX = canvas.width / 2;
                centerY = canvas.height - padding - circleBadgeSize / 2 - canvas.height * 0.02;
                break;
              case 'center':
                centerX = canvas.width / 2;
                centerY = canvas.height / 2;
                break;
              default:
                // fall back to template anchor if string not recognized
                try {
                  const tpl = getTemplateSettings();
                  const anchor = tpl?.selectedPosition ?? 'top-right';
                  switch (anchor) {
                    case 'top-left':
                      centerX = canvas.width / 2;
                      centerY = padding + circleBadgeSize / 2;
                      break;
                    case 'top-center':
                      centerX = canvas.width * 0.75;
                      centerY = padding + circleBadgeSize / 2;
                      break;
                    case 'top-right':
                      centerX = canvas.width - padding - circleBadgeSize / 2;
                      centerY = padding + circleBadgeSize / 2;
                      break;
                    case 'bottom-left':
                      centerX = padding + circleBadgeSize / 2;
                      centerY = canvas.height - padding - circleBadgeSize / 2;
                      break;
                    case 'bottom-center':
                      centerX = canvas.width / 2;
                      centerY = canvas.height - padding - circleBadgeSize / 2;
                      break;
                    case 'bottom-right':
                      centerX = canvas.width - padding - circleBadgeSize / 2;
                      centerY = canvas.height - padding - circleBadgeSize / 2;
                      break;
                    default:
                      centerX = canvas.width - padding - badgeSize / 2;
                      centerY = padding + badgeSize / 2;
                  }
                } catch (e) {
                  centerX = canvas.width - padding - badgeSize / 2;
                  centerY = padding + badgeSize / 2;
                }
            }
          } else {
            // no explicit pos — choose randomly between center-right and center-left
            // with small vertical jitter around the center. Overlap checks later will move it if needed.
            const side = Math.random() < 0.5 ? 'center-right' : 'center-left';
            const verticalJitter = (Math.random() - 0.5) * 0.1; // +/-5% of canvas height
            centerY = canvas.height * (0.5 + verticalJitter);
            if (side === 'center-right') {
              centerX = canvas.width * 0.75;
            } else {
              centerX = canvas.width * 0.25;
            }
          }

          // Clamp so the visual circle doesn't spill outside the image
          centerX = clamp(centerX, padding + circleBadgeSize / 2, canvas.width - padding - circleBadgeSize / 2);
          centerY = clamp(centerY, padding + circleBadgeSize / 2, canvas.height - padding - circleBadgeSize / 2);

          // If a template logo or company text exists, compute their estimated bounding boxes and avoid overlap
          try {
            const tpl = getTemplateSettings();
            if (tpl) {
              const logoBox = tpl.logoPreview && tpl.selectedPosition ? (() => {
                const logoSize = Math.min(canvas.width, canvas.height) * 0.12;
                const paddingLocal = Math.max(20, canvas.width * 0.02);
                let lx = paddingLocal, ly = paddingLocal;
                switch (tpl.selectedPosition) {
                  case 'top-left': lx = paddingLocal; ly = paddingLocal; break;
                  case 'top-center': lx = (canvas.width - logoSize) / 2; ly = paddingLocal; break;
                  case 'top-right': lx = canvas.width - logoSize - paddingLocal; ly = paddingLocal; break;
                  case 'bottom-left': lx = paddingLocal; ly = canvas.height - logoSize - paddingLocal; break;
                  case 'bottom-center': lx = (canvas.width - logoSize) / 2; ly = canvas.height - logoSize - paddingLocal; break;
                  case 'bottom-right': lx = canvas.width - logoSize - paddingLocal; ly = canvas.height - logoSize - paddingLocal; break;
                }
                return { x: lx, y: ly, w: logoSize, h: logoSize };
              })() : null;

              const textBox = tpl.companyText ? (() => {
                const fontSize = (tpl.textSize || 24) * (canvas.width / 1000);
                // estimate width as quarter of canvas or based on font size
                const tw = Math.min(canvas.width * 0.4, fontSize * (tpl.companyText?.length || 8));
                const paddingLocal = Math.max(20, canvas.width * 0.02);
                let tx = paddingLocal, ty = paddingLocal;
                switch (tpl.selectedPosition) {
                  case 'top-left': tx = paddingLocal; ty = paddingLocal + fontSize + 4; break;
                  case 'top-center': tx = (canvas.width - tw) / 2; ty = paddingLocal + fontSize + 4; break;
                  case 'top-right': tx = canvas.width - tw - paddingLocal; ty = paddingLocal + fontSize + 4; break;
                  case 'bottom-left': tx = paddingLocal; ty = canvas.height - paddingLocal - fontSize; break;
                  case 'bottom-center': tx = (canvas.width - tw) / 2; ty = canvas.height - paddingLocal - fontSize; break;
                  case 'bottom-right': tx = canvas.width - tw - paddingLocal; ty = canvas.height - paddingLocal - fontSize; break;
                }
                return { x: tx, y: ty, w: tw, h: fontSize + 4 };
              })() : null;

              const overlaps = (bx: { x: number; y: number; w: number; h: number }, cx: { x: number; y: number; r: number }) => {
                if (!bx) return false;
                const left = cx.x - cx.r;
                const right = cx.x + cx.r;
                const top = cx.y - cx.r;
                const bottom = cx.y + cx.r;
                return !(right < bx.x || left > bx.x + bx.w || bottom < bx.y || top > bx.y + bx.h);
              };

              const badgeCircle = { x: centerX, y: centerY, r: circleBadgeSize / 2 };
              let moved = false;
              if (logoBox && overlaps(logoBox, badgeCircle)) {
                // prefer center-right then center-left then center-up then center-down
                const tryPositions: Array<{ x: number; y: number }> = [
                  { x: canvas.width * 0.75, y: canvas.height / 2 },
                  { x: canvas.width * 0.25, y: canvas.height / 2 },
                  { x: canvas.width / 2, y: canvas.height * 0.25 },
                  { x: canvas.width / 2, y: canvas.height * 0.75 },
                ];
                for (const p of tryPositions) {
                  const c = { x: clamp(p.x, padding + circleBadgeSize / 2, canvas.width - padding - circleBadgeSize / 2), y: clamp(p.y, padding + circleBadgeSize / 2, canvas.height - padding - circleBadgeSize / 2), r: circleBadgeSize / 2 };
                  if (!overlaps(logoBox, c) && !(textBox && overlaps(textBox, c))) {
                    centerX = c.x; centerY = c.y; moved = true; break;
                  }
                }
              }

              if (!moved && textBox && overlaps(textBox, badgeCircle)) {
                const tryPositions: Array<{ x: number; y: number }> = [
                  { x: canvas.width * 0.75, y: canvas.height / 2 },
                  { x: canvas.width * 0.25, y: canvas.height / 2 },
                  { x: canvas.width / 2, y: canvas.height * 0.25 },
                  { x: canvas.width / 2, y: canvas.height * 0.75 },
                ];
                for (const p of tryPositions) {
                  const c = { x: clamp(p.x, padding + circleBadgeSize / 2, canvas.width - padding - circleBadgeSize / 2), y: clamp(p.y, padding + circleBadgeSize / 2, canvas.height - padding - circleBadgeSize / 2), r: circleBadgeSize / 2 };
                  if (!overlaps(textBox, c) && !(logoBox && overlaps(logoBox, c))) {
                    centerX = c.x; centerY = c.y; moved = true; break;
                  }
                }
              }
            }
          } catch (e) {
            // ignore and keep computed position
          }

          // radial gradient fill
          const g = ctx.createRadialGradient(centerX - circleBadgeSize * 0.12, centerY - circleBadgeSize * 0.18, circleBadgeSize * 0.05, centerX, centerY, circleBadgeSize / 1.1);
          g.addColorStop(0, hexToRgba(badgeHex, 1));
          g.addColorStop(1, hexToRgba(adjustColorLuminance(badgeHex, -0.06), 1));
          ctx.save();
          ctx.shadowColor = hexToRgba(badgeHex, 0.35);
          ctx.shadowBlur = Math.max(8, circleBadgeSize * 0.06);
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, circleBadgeSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
          // white sheen
          ctx.globalAlpha = 0.12;
          ctx.beginPath();
          ctx.ellipse(centerX - circleBadgeSize * 0.16, centerY - circleBadgeSize * 0.22, circleBadgeSize * 0.28, circleBadgeSize * 0.18, -0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.globalAlpha = 1;

          // text
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const badgeText = String(promo.name || promo.title || 'Offer');
          // Increase font size proportionally so text remains readable inside the bigger badge
          const fontSize = Math.max(14, badgeSize * 0.26);
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          // wrap and draw
          wrapTextCenter(ctx, badgeText, centerX, centerY, badgeSize * 0.78, fontSize + 2);
          ctx.restore();
        }

        // campaign/trend overlays removed — only promotion badges and template overlays are drawn

        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          console.warn('Canvas tainted when applying components, returning original image');
          resolve(imageUrl);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(imageUrl); };
      img.src = blobUrl;
    });
  } catch (err) {
    console.warn('Failed to apply components to image:', err);
    return imageUrl;
  }
};

// Expand short hex like #abc to #aabbcc
const expandShortHex = (hex: string) => {
  if (!hex) return '#000000';
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    return '#' + cleaned.split('').map(c => c + c).join('');
  }
  return '#' + cleaned.padStart(6, '0');
};

// Deterministic color from string
const stringToDeterministicHex = (s: string) => {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const r = (hash >> 16) & 0xff;
  const g = (hash >> 8) & 0xff;
  const b = hash & 0xff;
  const toHex = (v: number) => ('0' + (v & 0xff).toString(16)).slice(-2);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Convert hex to rgba string
const hexToRgba = (hex: string, alpha = 1) => {
  try {
    const clean = expandShortHex(hex).replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch (e) {
    return `rgba(0,0,0,${alpha})`;
  }
};

// Adjust luminance of hex by amount (-1..1)
const adjustColorLuminance = (hex: string, amount: number) => {
  try {
    const hsl = hexToHsl(hex);
    if (!hsl) return hex;
    const l = Math.max(0, Math.min(1, hsl.l + amount));
    return hslToHex({ h: hsl.h, s: hsl.s, l });
  } catch (e) {
    return hex;
  }
};

// Simple centered wrap text helper
const wrapTextCenter = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
  const words = String(text).split(' ');
  const lines: string[] = [];
  let current = words[0] || '';
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(current + ' ' + word).width;
    if (width < maxWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  const totalHeight = lines.length * lineHeight;
  let startY = y - totalHeight / 2 + lineHeight / 2;
  for (const line of lines) {
    ctx.fillText(line, x, startY);
    startY += lineHeight;
  }
};

// Rounded rectangle helper: draws path and optionally fills/strokes
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill = true, stroke = true) => {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
};