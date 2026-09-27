const backgrounds = ['#dbeafe', '#d9f6ef', '#fce7f3', '#fef3c7', '#e9e4ff']
const faces = ['round', 'square', 'oval']
const eyes = ['dots', 'wide', 'sleepy']
const mouths = ['smile', 'grin', 'surprised']
const decorations = ['freckles', 'blush', 'cap', 'none']

function pick(values, random) {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]
}

export function createAvatar(random = Math.random) {
  return {
    background: pick(backgrounds, random),
    face: pick(faces, random),
    eyes: pick(eyes, random),
    mouth: pick(mouths, random),
    decoration: pick(decorations, random),
  }
}

export function renderAvatarSvg(avatar) {
  const faceShape = {
    round: '<circle cx="128" cy="140" r="78" />',
    square: '<rect x="52" y="62" width="152" height="156" rx="54" />',
    oval: '<ellipse cx="128" cy="140" rx="72" ry="84" />',
  }
  const eyeShape = {
    dots: '<circle cx="100" cy="130" r="7" /><circle cx="156" cy="130" r="7" />',
    wide: '<ellipse cx="100" cy="130" rx="8" ry="11" /><ellipse cx="156" cy="130" rx="8" ry="11" />',
    sleepy:
      '<path d="M88 132q12 12 24 0M144 132q12 12 24 0" fill="none" stroke="#263b59" stroke-width="6" stroke-linecap="round" />',
  }
  const mouthShape = {
    smile:
      '<path d="M103 166q25 29 50 0" fill="none" stroke="#a84d58" stroke-width="7" stroke-linecap="round" />',
    grin: '<path d="M101 166q27 38 54 0Z" fill="#a84d58" />',
    surprised: '<ellipse cx="128" cy="178" rx="12" ry="17" fill="#a84d58" />',
  }
  const decorationShape = {
    freckles:
      '<circle cx="79" cy="158" r="3" /><circle cx="87" cy="164" r="3" /><circle cx="169" cy="164" r="3" /><circle cx="177" cy="158" r="3" />',
    blush:
      '<ellipse cx="79" cy="163" rx="13" ry="7" /><ellipse cx="177" cy="163" rx="13" ry="7" />',
    cap: '<path d="M55 96Q75 27 128 40Q181 27 201 96Z" fill="#245cd4" /><path d="M45 96h166" stroke="#173e90" stroke-width="12" stroke-linecap="round" />',
    none: '',
  }
  // Only preset values are accepted, so generated markup never contains user input.
  if (
    !backgrounds.includes(avatar.background) ||
    !Object.hasOwn(faceShape, avatar.face) ||
    !Object.hasOwn(eyeShape, avatar.eyes) ||
    !Object.hasOwn(mouthShape, avatar.mouth) ||
    !Object.hasOwn(decorationShape, avatar.decoration)
  ) {
    throw new Error('头像组合无效。')
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="随机生成的卡通头像"><rect width="256" height="256" rx="36" fill="${avatar.background}"/><g fill="#f6c9aa">${faceShape[avatar.face]}</g><g fill="#263b59">${eyeShape[avatar.eyes]}</g>${mouthShape[avatar.mouth]}<g fill="#e79a9c">${decorationShape[avatar.decoration]}</g></svg>`
}
