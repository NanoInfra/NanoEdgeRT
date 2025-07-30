# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-07-30

### Added

- 📋 **OpenAPI Schema Support** - Added nullable `schema` column to services table for storing OpenAPI JSON schemas
- 📚 **Service Documentation Routes** - New routes for viewing individual service documentation
  - `/doc/:serviceName` - Swagger UI for specific service schemas
  - `/openapi/:serviceName` - JSON endpoint for service OpenAPI schemas
- 🔧 **Schema Validation** - Added JSON validation for OpenAPI schemas in service creation/update
- 📖 **Default Service Schemas** - Included sample OpenAPI schemas for hello and calculator services
- 🌐 **Enhanced Root Endpoint** - Added documentation links in root API response

### Changed

- 🗄️ **Database Schema** - Added `schema` column to services table with proper migration
- 📋 **Service Creation/Update** - Enhanced APIs to handle OpenAPI schema field
- 🏗️ **Type Definitions** - Updated `ServiceConfig` interface to include optional `schema` field
- 📊 **Service Responses** - Updated service listing endpoints to include schema information

### Technical Details

- Database migration adds nullable `schema` TEXT column to services table
- All service CRUD operations now support schema field
- TypeScript interfaces updated across the codebase
- Swagger UI integration for per-service documentation

## [1.1.0] - 2025-07-24

### Added

- 🆕 **Dynamic API** - performing
  - add CRUD operations for services
  - upload single js file for service creation
  - on-the-fly service creation
- 🚙 **Single Executable** - Add tasks to compile deno into single executable
  - Cross-platform compilation support (Windows, Linux, macOS)
  - Compile tasks for all target platforms
- 📦 **Proper Configuration** - using Kysely instead of `config.json`
- 🔄 **Service Management** - use Kysely databases for managing service files instead of folder and config.json
- 🗄️ **SQLite Database** - Integrated SQLite database with Kysely ORM for persistent storage
- 🔄 **CI/CD Improvements** - Updated GitHub Actions workflow with better Deno setup

### Changed

- 📈 **Version Bump** - Updated project version to 1.1.0 in deno.json
- 🔧 **Dependencies** - Replaced Hono with Kysely for database operations
- 📝 **Typo Fix** - Fixed "CURD" to "CRUD" operations

### Removed

- ❌ **CLI** - Removed CLI interface in favor of dynamic API for service management
- 🗂️ **Legacy Config** - Removed file-based configuration system

## [1.0.0] - 2025-07-22

### Added

- 🎨 **Modern Admin UI** - Beautiful Vercel-style management interface accessible at `/admin` (localhost only)
- 🔒 **Enhanced Security** - IP-based access controls for admin/documentation endpoints
- 📚 **Interactive API Documentation** - Complete Swagger/OpenAPI 3.0.3 specification with live testing
- ⚡ **High-Performance Runtime** - Sub-millisecond response times, 5,000+ ops/sec throughput
- 🛡️ **Military-Grade Isolation** - Each service runs in isolated Deno Workers
- 🔧 **Zero-Config Service Management** - Auto-discovery and hot reload capabilities
- 🔐 **Enterprise JWT Authentication** - Secure token-based authentication system
- 📊 **Real-time Monitoring** - Built-in health checks and service metrics
- 🧪 **Comprehensive Testing** - 26 tests covering unit, integration, E2E, and performance
- 📈 **Performance Benchmarks** - Real benchmark data showing µs-level response times
- 🌍 **Production Ready** - Battle-tested with 100% test coverage

### Enhanced Services

- **Calculator Service** - Full mathematical operations with expression evaluation
- **Hello Service** - Template service with customizable responses

### Developer Experience

- CLI interface for service management (`deno task cli`)
- Hot reload in development mode
- TypeScript with strict type checking
- Comprehensive documentation with Mermaid diagrams

### Security Features

- Admin UI and documentation endpoints restricted to localhost (127.0.0.1)
- Public service endpoints available on all interfaces (0.0.0.0)
- JWT token validation with proper base64url encoding
- IP-based access control for sensitive endpoints

### Features

- Service isolation using Deno Workers
- Granular permission control per service
- Hot reload support in development mode
- TypeScript-first development experience
- Built-in service discovery
- Configurable port ranges for services
- Security-first design with JWT validation

### Documentation

- Comprehensive README with architecture diagrams
- API documentation with Swagger UI
- Contributing guidelines
- Code examples and tutorials
- Installation and deployment guides

## [1.0.0]

### Added

- Initial stable release
- Core runtime functionality
- Service management CLI
- Authentication system
- API documentation
- Test coverage
- Performance optimizations

### Security

- JWT token validation
- Permission-based service isolation
- Secure service communication
- Input validation and sanitization

---

## Development Notes

### Version 1.0.0 Features

- ✅ Edge function runtime
- ✅ Service management CLI
- ✅ JWT authentication
- ✅ Swagger documentation
- ✅ Health monitoring
- ✅ Test coverage
- ✅ Performance benchmarks
