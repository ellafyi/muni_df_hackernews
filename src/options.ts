const description = document.querySelector<HTMLElement>('.notes p');

if (!description) {
  throw new Error('Forum Newsreader options markup is incomplete.');
}

description.textContent = 'Forum Newsreader changes only IS MU discussion presentation: indexes become compact story listings, while replies retain their true nesting and become easier to scan. It never changes posts or submits data.';
