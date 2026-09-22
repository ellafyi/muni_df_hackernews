const description = document.querySelector<HTMLElement>('.notes p');

if (!description) {
  throw new Error('Forum Newsreader options markup is incomplete.');
}

description.textContent = 'Extension only restyles the forum, content stays unchanged';
