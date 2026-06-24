import { Clipboard } from 'react-native';

// How long a copied secret is allowed to linger on the shared system
// clipboard before we wipe it. Long enough to paste into another field,
// short enough to limit exposure to other apps / clipboard history.
export const SECRET_CLIPBOARD_TTL_MS = 60_000;

/**
 * Copy a sensitive value (a WIF private key, an extended public key, etc.)
 * to the clipboard, then automatically clear it after `ttlMs`.
 *
 * The system clipboard is shared across every app on the device, so a secret
 * left there can be read by other apps, clipboard-history tools, or pasted by
 * accident long after the user is done. We clear it on a timer, but only if it
 * still holds the same value — that way we never clobber something the user
 * copied in the meantime. Best-effort: this never throws.
 */
export function copyEphemeralSecret(
  value: string,
  ttlMs: number = SECRET_CLIPBOARD_TTL_MS,
): void {
  Clipboard.setString(value);
  setTimeout(() => {
    Promise.resolve(Clipboard.getString())
      .then(current => {
        if (current === value) {
          Clipboard.setString('');
        }
      })
      .catch(() => {
        // best-effort cleanup; never surface an error from a background timer
      });
  }, ttlMs);
}
