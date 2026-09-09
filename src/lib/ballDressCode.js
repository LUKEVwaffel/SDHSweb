// Military Ball dress code — HARDCODED, single source of truth.
//
// Rendered by <DressCodeDetails /> on the guest verify page, the signup
// wizard's last step, and (as a short summary) the ball landing page.
// ball_config.dress_code_text is now only an OPTIONAL extra note appended
// under these lists — the lists themselves live here and change with a deploy.
// Keep in sync with whatever S-6 hands out on paper.

export const FEMALE_AVOID = [
  'Two-piece dresses',
  'Mesh panels or a bare midriff',
  'Low-cut necklines / visible cleavage',
  'No plunge on the chest — meaning no deep V, scoop, or keyhole neckline that dips more than about two inches below the collarbone or shows any cleavage. The neckline must sit at or above the top of the bust.',
  'Strapless dresses',
  'Boots, sandals, or tennis shoes',
  'A slit above mid-thigh',
  'Anything tight below mid-thigh',
  'Short dresses',
  'An open back that drops past halfway',
];

export const FEMALE_WEAR = [
  'A long formal dress, ankle length or longer (not partway up the shin — ask if unsure)',
  'Heels or flats (dress shoes)',
  'Spaghetti straps and off-the-shoulder are fine',
  'This is a formal event — dress nicely, and pick something you can dance and sit in',
];

export const MALE_AVOID = [
  'Jeans',
  'T-shirts',
  'Hats',
  'Tennis shoes or slides',
];

export const MALE_WEAR = [
  'A black-and-white suit with a bowtie, OR Class A uniform with a white shirt and bowtie',
  'Dress shoes',
  'Facial hair within regulation',
];

// Approval process — applies to every female attendee (cadets AND guests).
export const DRESS_APPROVAL_RULES = [
  'Every female attendee — cadets and guests — must have her dress approved before the ball.',
  'If you paid but your dress is not approved, you will be denied entry.',
  'Send a photo of the front AND back of the dress while you are wearing it.',
  'After you pay, come back to this website and fill out the online form.',
  'Females are approved ONLY by Aubrey or Kylie. Males message ONLY Weston.',
  'Turn in your field trip form when you pay for your tickets.',
];
