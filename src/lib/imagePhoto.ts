/**
 * Turning a phone photo into something worth storing.
 *
 * A photo straight off a phone is 3–5 MB. This plan allows 1 GB of storage and
 * 5 GB of egress a month, and 175 ingredients at 4 MB each would fill the first
 * on its own. So nothing is ever uploaded as taken: every photo is re-encoded
 * here, in the browser, before it goes anywhere.
 *
 * Two sizes come out, because the row and the sheet want very different things.
 * A list of 175 thumbs has to cost almost nothing — it is drawn every time
 * anyone walks the route — while the full image is fetched only when somebody
 * actually taps a row.
 */

/** Long edge of the image opened by tapping a row. */
const FULL_EDGE = 1024
/** Long edge of the 36px thumbnail in the row. Twice over, for a retina phone. */
const THUMB_EDGE = 96
const QUALITY = 0.8

export type PreparedPhoto = {
  full: Blob
  thumb: Blob
  /** 'image/webp' or 'image/jpeg' — whichever this browser could actually encode. */
  type: string
}

/**
 * Draw `bitmap` scaled to fit `edge` on its long side, never upscaling, and
 * encode it. Returns the blob and the type that came back, which is not always
 * the type that was asked for — see `encode`.
 */
async function render(bitmap: ImageBitmap, edge: number, type: string): Promise<Blob> {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not prepare the photo.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  return encode(canvas, type)
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('This browser could not prepare the photo.')),
      type,
      QUALITY,
    )
  })
}

/**
 * Downscale and re-encode a chosen photo.
 *
 * Two things here are not decoration:
 *
 * `imageOrientation: 'from-image'` applies the EXIF rotation a phone writes
 * rather than the pixels it stores. A canvas ignores EXIF, so without this
 * every photo taken in the obvious way arrives on its side.
 *
 * The WebP check is the one that would have cost real money. `toBlob` does not
 * fail on a type it cannot encode — it quietly returns PNG instead, and a
 * 1024px PNG is megabytes. Safari only learned to encode WebP in 17. So the
 * type that comes back is checked rather than assumed, and anything that isn't
 * WebP is re-encoded as JPEG, which every browser here can do.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    let full = await render(bitmap, FULL_EDGE, 'image/webp')
    let type = 'image/webp'

    if (full.type !== 'image/webp') {
      type = 'image/jpeg'
      full = await render(bitmap, FULL_EDGE, type)
    }

    const thumb = await render(bitmap, THUMB_EDGE, type)
    return { full, thumb, type }
  } finally {
    // The decoded bitmap is the biggest thing in memory here — several times
    // the file — and a kitchen phone has little to spare.
    bitmap.close()
  }
}
