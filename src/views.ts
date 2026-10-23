export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
function page(title: string, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Maxial</title><link rel="stylesheet" href="/style.css"></head><body><main><h1>${title}</h1>${content}</main></body></html>`;
}
export function loginView(message = '') {
  return page('Sign in', `${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}<form method="post" action="/login"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="200"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024"><button>Sign in</button></form>`);
}
/** Render lookup results and show administrator navigation only for that session role. */
export function searchView(value = '', message = '', number?: string, administrator = false) {
  return page('Find a photo', `${administrator ? '<p><a href="/admin/upload">Upload a photo</a></p>' : ''}<form method="post" action="/logout" class="logout"><button>Sign out</button></form><form method="get" action="/"><label for="number">Photo number</label><input id="number" name="number" type="text" inputmode="numeric" pattern="[0-9]{1,4}" maxlength="4" value="${escapeHtml(value)}" required><button>Show photo</button></form>${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}${number ? `<figure><img src="/photos/${number}" alt="Photo ${number}"><figcaption>Photo ${number}</figcaption></figure>` : ''}`);
}
export const stylesheet = `*{box-sizing:border-box}input{min-width:0;width:100%}:root{font:18px system-ui;color:#183233;background:#f3f6f3}body{margin:0;padding:2rem 1rem}main{max-width:48rem;margin:auto;background:white;padding:2rem;border-radius:1rem}h1{margin-top:0}form{display:grid;gap:.7rem;max-width:24rem}input,button{font:inherit;padding:.7rem;border-radius:.4rem;border:1px solid #9aabab}button{background:#175a50;color:white;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #b85a18;outline-offset:3px}.logout{margin-bottom:2rem}figure{margin:2rem 0 0}img{max-width:100%;height:auto}figcaption{margin-top:.5rem}[role=alert]{color:#9b241e}`;

/** Render one native photo picker, leaving available source choices to the device. */
export function uploadView(message = ''): string {
  return page('Upload a photo', `<p><a href="/">Back to search</a></p><p>PNG, JPEG or HEIC/HEIF. Maximum 30 MB. Photos are resized without cropping and saved as PNG below 100 kB.</p>${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}<form method="post" action="/admin/upload" enctype="multipart/form-data"><label for="upload-number">Photo number</label><input id="upload-number" name="number" inputmode="numeric" pattern="[0-9]{1,4}" maxlength="4" required><label for="upload-photo">Choose a file</label><input id="upload-photo" type="file" name="photo" accept="image/*,.heic,.heif" required><button>Upload photo</button></form>`);
}

/** Identify the exact pending replacement and require an explicit confirm or cancel POST. */
export function confirmationView(pending: { number: string; token: string }, conflict: boolean): string {
  const { number, token } = pending;
  return page('Replace a photo?', `${conflict ? '<p role="alert">The existing photo changed. Review it again before confirming.</p>' : ''}<p>Replace photo ${number}? The current image remains available until you confirm.</p><h2>Current photo</h2><img src="/photos/${number}" alt="Current photo ${number}"><h2>Prepared photo</h2><img src="/admin/upload/${token}/preview" alt="Prepared photo ${number}"><form method="post" action="/admin/upload/${token}/confirm"><button>Confirm replacement</button></form><form method="post" action="/admin/upload/${token}/cancel"><button>Cancel replacement</button></form>`);
}
