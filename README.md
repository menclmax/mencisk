# MencLAB - Retro Portfolio Launchpad

A retro synthwave-styled Next.js portfolio website that serves as a launchpad for web apps and projects.

## Features

- 🎮 8-bit retro aesthetic with synthwave vibes
- 🚀 Project launchpad with filtering
- 💫 Neon glow effects and animations
- 📱 Responsive design
- ⚡ Built with Next.js 14 and TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

- `/app` - Next.js app directory with pages and layouts
- `/components` - React components (Header, Launchpad, ProjectCard)
- `/app/globals.css` - Global styles with retro theme

## Customization

### Adding Projects

Edit `/components/Launchpad.tsx` and add your projects to the `projects` array:

```typescript
{
  id: 'unique-id',
  name: 'PROJECT NAME',
  description: 'Project description',
  url: 'https://your-project-url.com',
  category: 'Web App' | 'Project',
  status: 'active' | 'coming-soon' | 'archived',
  icon: '🚀' // Optional emoji icon
}
```

### Styling

The theme colors can be customized in `/app/globals.css`:

- `--neon-cyan`: Main cyan color
- `--neon-pink`: Accent pink color
- `--neon-purple`: Secondary purple color
- `--dark-bg`: Background color

## Build for Production

```bash
npm run build
npm start
```

## License

MIT

