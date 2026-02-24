/**
 * FYI Guard - Disposable / Temporary Email Domain Blocklist
 *
 * Blocks registration with known disposable email providers.
 * Production-level list covering the most common temp email services.
 */

const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  // Major disposable email providers
  'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamail.de', 'grr.la', 'guerrillamailblock.com',
  'mailinator.com', 'mailinator.net', 'mailinator2.com',
  'throwaway.email', 'throwaway.com', 'throwawaym ail.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'sharklasers.com', 'guerrillamail.info', 'spam4.me',
  'trashmail.com', 'trashmail.net', 'trashmail.org', 'trashmail.me',
  'mailnesia.com', 'maildrop.cc', 'dispostable.com',
  'fakeinbox.com', 'tempail.com', 'tempr.email',
  'discard.email', 'discardmail.com', 'discardmail.de',
  'getnada.com', 'nada.email', 'nada.ltd',
  'mohmal.com', 'burnermail.io', 'inboxbear.com',
  'mailcatch.com', 'tempinbox.com', 'trash-mail.com',
  'harakirimail.com', 'mailexpire.com', 'tempmailo.com',
  'emailondeck.com', 'mintemail.com', 'tempmailaddress.com',
  '10minutemail.com', '10minutemail.net', '10minutemail.org',
  '20minutemail.com', '20minutemail.it',
  'mailtemp.org', 'mytemp.email', 'tmpmail.net', 'tmpmail.org',
  'crazymailing.com', 'disposableemailaddresses.emailmiser.com',
  'mailnull.com', 'spamgourmet.com', 'spamgourmet.net',
  'getairmail.com', 'filzmail.com', 'inboxalias.com',
  'jetable.org', 'jourrapide.com', 'kasmail.com',
  'mailforspam.com', 'mailscrap.com', 'mailzilla.com',
  'nomail.xl.cx', 'objectmail.com', 'proxymail.eu',
  'rcpt.at', 'reallymymail.com', 'recode.me',
  'spaml.com', 'superrito.com', 'tittbit.in',
  'trashymail.com', 'uggsrock.com', 'wegwerfmail.de',
  'wegwerfmail.net', 'wh4f.org', 'yolanda.dev',
  'mailsac.com', 'moakt.com', 'receiveee.com',
  'spambox.us', 'spamfree24.org', 'trashmail.io',
  // Russian temp mail providers
  'mail.ru.temp', 'tempail.ru',
  // Additional common ones
  'duck.com', 'simplelogin.co', 'anonaddy.me',
  'boun.cr', 'byom.de', 'chammy.info',
  'dayrep.com', 'einrot.com', 'emailisvalid.com',
  'fleckens.hu', 'get2mail.fr', 'gustr.com',
  'hatespam.org', 'ipoo.org', 'lackmail.net',
  'lhsdv.com', 'maileater.com', 'mailnator.com',
  'meltmail.com', 'mt2015.com', 'nobulk.com',
  'owlpic.com', 'pjjkp.com', 'putthisinyouremail.com',
  'rhyta.com', 'sharklasers.com', 'skeefmail.com',
  'slipry.net', 'snkmail.com', 'sofimail.com',
  'spamhereplease.com', 'spamobox.com', 'teleworm.us',
  'thankdog.net', 'tmail.ws', 'tmails.net',
  'tormail.org', 'trash2009.com', 'trbvm.com',
  'uroid.com', 'veryreallye mail.com', 'vomoto.com',
  'walala.org', 'webemail.me', 'wuzup.net',
  'xagloo.co', 'yapped.net', 'zapto.org',
]);

/** Check if an email domain is a known disposable/temporary provider */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/** Get the domain from an email */
export function getEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase().trim() || '';
}

export { DISPOSABLE_DOMAINS };