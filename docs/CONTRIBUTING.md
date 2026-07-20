# Contributing to Ikol Bot

Thank you for your interest in contributing to Ikol! This document provides guidelines and information for contributors.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow the project's coding standards

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Cloudflare account (for testing deployments)
- Telegram Bot Token (for testing)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/ikol-bot.git
   cd ikol-bot
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Keep functions small and focused
- Add types for all function parameters and return values

### File Structure

- Place new modules in `src/modules/`
- Keep services in `src/services/`
- Add types to `src/types/`
- Utility functions go in `src/utils/`

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add new music search feature
fix: resolve download timeout issue
docs: update API documentation
refactor: improve error handling
test: add unit tests for finance module
```

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Run tests with `npm test`

## Adding a New Module

1. Create a new directory in `src/modules/your-module/`

2. Create `index.ts` with the module:
   ```typescript
   import { Composer } from 'grammy';
   
   const bot = new Composer();
   
   bot.command('yourcommand', async (ctx) => {
     // Your command logic
   });
   
   export default bot;
   ```

3. Register the module in `src/bot/index.ts`:
   ```typescript
   import yourModule from '../modules/your-module/index.js';
   
   // Add to bot.use() calls
   bot.use(yourModule);
   ```

4. Add any new API clients to `src/services/api/index.ts`

5. Update documentation in `README.md`

## Submitting Changes

1. Ensure your code follows the style guidelines
2. Run linting: `npm run lint`
3. Run type checking: `npm run typecheck`
4. Run tests: `npm test`
5. Commit your changes
6. Push to your fork
7. Create a Pull Request

### PR Description

Include in your PR:
- Description of changes
- Motivation for changes
- Any breaking changes
- Testing performed

## Reporting Issues

- Use GitHub Issues
- Include reproduction steps
- Include error messages/logs
- Specify your environment (OS, Node version, etc.)

## Feature Requests

- Open a GitHub Issue
- Describe the feature clearly
- Explain use cases
- Consider implementation complexity

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to open an issue for any questions about contributing!
