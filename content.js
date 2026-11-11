export const PORTFOLIO = {
  about: {
    kicker: 'A little about me',
    title: 'Soufiane Tajri',
    subtitle: 'Game designer & developer',
    paragraphs: [
      'I’m a game design and development student building responsive gameplay systems and prototypes in Unity and Godot.',
      'My work centers on player control, interaction, and system-driven mechanics in both 2D and 3D. I choose tools to fit the problem, and care about making every interaction feel intentional.',
    ],
  },
  skills: {
    kicker: 'Tools around camp',
    title: 'What I bring',
    subtitle: 'A mix of craft, code & curiosity',
    skills: [
      'Unity / C#',
      'Godot 4 / GDScript',
      'Gameplay programming',
      'Game design',
      'Level design',
      'Character design',
      '2D & 3D animation',
      'Version control',
    ],
  },
  projects: {
    kicker: 'Stories from the trail',
    title: 'Selected work',
    subtitle: 'A few projects from the journey',
  },
  education: {
    kicker: 'Trail markers',
    title: 'Where I learned',
    subtitle: 'Growing the craft, one project at a time',
    entries: [
      { title: 'ENSAD', detail: 'Bac+5 Game Design & Animation', date: '2024 — 2027' },
      { title: 'BTS', detail: 'Information Systems Development', date: '2022 — 2024' },
    ],
  },
  contact: {
    kicker: 'Keep in touch',
    title: 'Say hello.',
    subtitle: 'Player two wanted ✳',
    paragraph: 'Have a project, a question, or just want to talk games? I’d love to hear from you.',
  },
};

export const PROJECTS = [
  // Replace the generated cover art with real captures when screenshots are available.
  {
    title: 'The Third Perspective',
    description: 'A high-stakes legal simulation where you deliver justice by investigating evidence and interrogating suspects under pressure.',
    status: 'HACKATHON WINNER',
    slug: 'the-third-perspective',
    image: projectArtwork('TP', '#dce6d0', '#627d55'),
    imageAlt: 'Illustrative cover art for The Third Perspective',
    url: 'https://soufiane-tajri.netlify.app/#/project/the-third-perspective',
    playUrl: null,
    repo: null,
    tags: ['Legal simulation', 'Game design'],
  },
  {
    title: 'HOMA',
    description: 'A 2D mobile platformer built in Godot that won the Gaming Hackathon 2025 at ENSAD.',
    status: 'HACKATHON WINNER',
    slug: 'homa',
    image: 'https://github.com/user-attachments/assets/dd73b4c2-3dc3-45b1-9608-88544c56d1e9',
    imageAlt: 'HOMA gameplay screenshot',
    url: 'https://soufiane-tajri.netlify.app/#/project/homa',
    playUrl: 'https://drive.google.com/drive/folders/1qNRXFCCOlqFIJJkcPAiyiZthgby7o0_W?usp=sharing',
    repo: 'https://github.com/Sofdev005/Homa-Game---mobile-game',
    tags: ['Godot', '2D', 'Mobile', 'Gameplay programming'],
  },
  {
    title: 'Paralysis Dream',
    description: 'A psychological horror game made from scratch — level design, sound, 3D assets, and gameplay programming.',
    status: 'RELEASED',
    slug: 'paralysis-dream',
    image: 'https://github.com/user-attachments/assets/f0707ba0-40ec-4240-8f1a-1da08bb602e4',
    imageAlt: 'Paralysis Dream gameplay screenshot',
    url: 'https://soufiane-tajri.netlify.app/#/project/paralysis-dream',
    playUrl: null,
    repo: 'https://github.com/Sofdev005/Paralysis-dream---Psychological-horror-game-',
    tags: ['Unity', 'C#', 'Horror', '3D', 'Gameplay programming'],
  },
  {
    title: 'Skyfall',
    description: 'A 2D solo Unity game focused on clean architecture, responsive controls, and polished game feel.',
    status: 'RELEASED',
    slug: 'skyfall',
    image: 'https://github.com/user-attachments/assets/582254f9-13ba-4a0c-a1c9-10df38588564',
    imageAlt: 'Skyfall game design screenshot',
    url: 'https://soufiane-tajri.netlify.app/#/project/skyfall',
    playUrl: null,
    repo: 'https://github.com/Sofdev005/Skyfall--2D-game-prototype',
    tags: ['Unity', 'C#', '2D', 'Solo'],
  },
  {
    title: 'Asylum: Fractured Mind',
    description: 'A psychological horror game set in a derelict asylum, shaped by atmosphere, tension, and narrative-driven exploration.',
    status: 'IN DEVELOPMENT',
    slug: 'asylum-fractured-mind',
    image: projectArtwork('AFM', '#d5c9c4', '#745b59'),
    imageAlt: 'Illustrative cover art for Asylum: Fractured Mind',
    url: 'https://soufiane-tajri.netlify.app/#/project/asylum-fractured-mind',
    playUrl: null,
    repo: null,
    tags: ['Horror', 'Narrative design'],
  },
];

function projectArtwork(title, background, accent) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="280" viewBox="0 0 640 280"><rect width="640" height="280" rx="28" fill="${background}"/><circle cx="500" cy="85" r="95" fill="${accent}" opacity=".18"/><path d="M0 225c130-55 250-4 360-42 105-37 195-39 280-4v101H0z" fill="${accent}" opacity=".38"/><text x="42" y="152" fill="${accent}" font-family="Arial,sans-serif" font-size="54" font-weight="700">${title}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const LINKS = {
  portfolio: 'https://soufiane-tajri.netlify.app/',
  email: 'mailto:sofian16tajri@gmail.com',
  github: 'https://github.com/Sofdev005',
  linkedin: 'https://www.linkedin.com/in/soufiane-tajri-50a488257',
  cv: 'https://soufiane-tajri.netlify.app/CV/cv.pdf',
};
