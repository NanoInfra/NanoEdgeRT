# Contributing to NanoEdgeRT

Thank you for your interest in contributing to NanoEdgeRT! 🎉

This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- [Deno](https://deno.land/) v1.37 or higher
- [Git](https://git-scm.com/)
- Basic knowledge of TypeScript and Deno

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/your-username/nanoedgert.git
   cd nanoedgert
   ```

2. **Initialize the development environment:**
   ```bash
   deno task init
   ```

3. **Start the development server:**
   ```bash
   deno task dev
   ```

4. **Run tests to ensure everything works:**
   ```bash
   deno task test
   ```

## 📋 Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements

Examples:

- `feature/add-websocket-support`
- `fix/jwt-token-validation`
- `docs/update-api-examples`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style changes
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

Examples:

- `feat(auth): add OAuth2 support`
- `fix(service-manager): resolve worker memory leak`
- `docs(readme): update installation instructions`

### Code Quality

Before submitting a PR, ensure your code meets our standards:

```bash
# Format code
deno task fmt

# Lint code
deno task lint

# Type check
deno task check

# Run all tests
deno task test
```

## 🧪 Testing Guidelines

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Test individual functions/classes in isolation
   - Mock external dependencies
   - Fast execution

2. **Integration Tests** (`tests/integration/`)
   - Test component interactions
   - Use real implementations where possible
   - Test configuration and startup

3. **E2E Tests** (`tests/e2e/`)
   - Test complete user workflows
   - Require running server
   - Test real API endpoints

### Writing Tests

```typescript
import { assertEquals, assertExists } from "../test_utils.ts";

Deno.test("Feature - should work correctly", () => {
  // Arrange
  const input = "test";

  // Act
  const result = processInput(input);

  // Assert
  assertEquals(result, "expected");
});

Deno.test({
  name: "Async Feature - should handle async operations",
  async fn() {
    // Test async functionality
    const result = await asyncOperation();
    assertExists(result);
  },
  sanitizeResources: false, // If needed
  sanitizeOps: false, // If needed
});
```

### Test Coverage

- Aim for at least 80% code coverage
- Test both success and error scenarios
- Include edge cases and boundary conditions
- Mock external dependencies appropriately

## 📝 Documentation

### Code Documentation

- Use JSDoc comments for public APIs
- Document complex algorithms and business logic
- Include examples for public functions

````typescript
/**
 * Validates a JWT token and returns the decoded payload.
 *
 * @param token - The JWT token to validate
 * @param secret - The secret key for validation
 * @returns Promise resolving to decoded payload or null if invalid
 *
 * @example
 * ```typescript
 * const payload = await validateToken("eyJ...", "secret");
 * if (payload) {
 *   console.log(`User: ${payload.sub}`);
 * }
 * ```
 */
async function validateToken(token: string, secret: string): Promise<Payload | null> {
  // Implementation
}
````

### API Documentation

- Update OpenAPI specs for API changes
- Include request/response examples
- Document error conditions

### README Updates

- Update feature lists for new functionality
- Add examples for new CLI commands
- Update configuration documentation

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear Description**: What happened vs. what was expected
2. **Steps to Reproduce**: Minimal steps to reproduce the issue
3. **Environment**: Deno version, OS, etc.
4. **Code Examples**: Minimal code that demonstrates the issue
5. **Error Messages**: Full error messages and stack traces

### Bug Report Template

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Environment:**

- OS: [e.g. macOS 13.0]
- Deno version: [e.g. 1.37.0]
- NanoEdgeRT version: [e.g. 1.0.0]

**Additional context**
Add any other context about the problem here.
```

## ✨ Feature Requests

When proposing new features:

1. **Use Case**: Describe the problem you're solving
2. **Proposed Solution**: High-level description of your idea
3. **Alternatives**: Other solutions you considered
4. **Breaking Changes**: Any potential breaking changes

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions.

**Additional context**
Add any other context or screenshots about the feature request.
```

## 🔧 Development Guidelines

### Code Style

- Use TypeScript with strict type checking
- Follow Deno's standard formatting (`deno fmt`)
- Prefer explicit types over `any`
- Use meaningful variable and function names
- Keep functions small and focused

### Architecture Principles

1. **Separation of Concerns**: Each module should have a single responsibility
2. **Dependency Injection**: Avoid hard dependencies, use dependency injection
3. **Error Handling**: Handle errors gracefully and provide meaningful messages
4. **Performance**: Consider performance implications of changes
5. **Security**: Follow security best practices

### Adding New Services

When adding example services:

1. Create a new directory in `nanoedge/services/`
2. Include comprehensive error handling
3. Add examples to documentation
4. Test with both authenticated and unauthenticated requests

### API Changes

For breaking API changes:

1. Discuss in an issue first
2. Provide migration guide
3. Update version according to semver
4. Update all documentation

## 🚀 Release Process

### Version Numbers

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. Update version in `deno.json`
2. Update CHANGELOG.md
3. Run full test suite
4. Create release PR
5. Tag release after merge
6. Update documentation

## 🤝 Code Review

### For Authors

- Keep PRs focused and small
- Write clear PR descriptions
- Include tests for new functionality
- Update documentation as needed
- Be responsive to feedback

### For Reviewers

- Be constructive and respectful
- Focus on code quality and maintainability
- Check for test coverage
- Verify documentation updates
- Test the changes locally

## 📞 Getting Help

If you need help:

1. **Check existing issues** - Your question might already be answered
2. **Start a discussion** - For general questions
3. **Join our community** - Links in README
4. **Contact maintainers** - For urgent issues

## 🏆 Recognition

Contributors will be recognized in:

- CONTRIBUTORS.md file
- Release notes
- Annual contributor highlights

Thank you for making NanoEdgeRT better! 🙏
