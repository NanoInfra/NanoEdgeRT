# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.0] - 2025-08-03

### 🚀 Function Management System

### Added

- 🎯 **Function Management API** - Complete CRUD operations for serverless functions
  - `POST /admin-api/v2/functions` - Create new functions with code and permissions
  - `GET /admin-api/v2/functions` - List all functions
  - `GET /admin-api/v2/functions/{name}` - Get specific function details
  - `PUT /admin-api/v2/functions/{name}` - Update existing functions
  - `DELETE /admin-api/v2/functions/{name}` - Delete functions
- 🔄 **Function Execution Engine** - Execute functions in isolated Deno workers
  - `POST /functions/v2/{name}` - Execute functions with parameters
  - Support for both streaming (generators) and non-streaming responses
  - Proper error handling and timeout management
  - Configurable execution timeout via database config
- 💾 **Database Schema Enhancement** - New functions table with comprehensive metadata
  - Function code storage in database
  - Permissions management (read, write, env, run)
  - Enable/disable function toggle
  - Creation and update timestamps
- 🛡️ **Security & Isolation** - Functions run in sandboxed Deno workers
  - Granular permission control per function
  - Isolated execution environment
  - Resource cleanup and timeout protection
- 📊 **Streaming Support** - Generator functions for real-time data streaming
  - Server-sent events (SSE) for streaming responses
  - Progress tracking for long-running operations
  - Proper stream lifecycle management

### Enhanced

- 🔧 **Database Configuration** - Added `function_execution_timeout` setting
- 📚 **OpenAPI Documentation** - Complete API documentation for function management
- 🧪 **Test Coverage** - Comprehensive unit and integration tests for function system

## [2.1.0] - 2025-08-01

### 🎨 Frontend Hosting Feature

### Added

- 🌐 **Frontend Hosting API** - New `/admin-api/v2/host-frontend` endpoint for deploying frontend applications
  - Support for multipart form uploads with server JavaScript file and static assets ZIP
  - Automatic extraction of static files to `./static/{serviceName}` directory
  - Service creation with appropriate file system permissions for static file serving
  - JSZip integration for handling ZIP file extraction
- 🔧 **Enhanced Service Management** - Services can now be created with read permissions to static directories
- 📚 **Updated OpenAPI Documentation** - Added comprehensive documentation for the frontend hosting endpoint
  - Multipart form data schema definitions
  - File upload parameter specifications
  - Response schemas with success and error cases

### Technical Details

- Added `jszip` dependency for ZIP file handling
- Enhanced admin API with file upload capabilities
- Automatic directory creation for static file hosting
- Comprehensive error handling for invalid file types and missing parameters

## [2.0.0] - 2025-08-01

### 🚀 Major Architecture Overhaul

This version represents a complete architectural transformation of NanoEdgeRT, introducing versioned APIs, enhanced authentication, and modernized service management.

### Added

- 🔗 **Versioned API Architecture** - Introduced `/api/v2` and `/admin-api/v2` routes for better API versioning
- 🔐 **Enhanced JWT Authentication System** - Complete JWT authentication infrastructure with admin-specific tokens
  - Dedicated admin JWT secret management
  - JWT payload interface with extensible claims
  - Middleware-based authentication pipeline
- 🛡️ **Security-First Admin API** - New `/admin-api/v2` endpoints with mandatory JWT authentication
  - All admin operations now require authentication
  - Secure service and configuration management
  - JWT-protected CRUD operations
- 📊 **Advanced Database Context Management** - Improved database context injection across all routes
- 🔧 **Modernized Service Architecture** - Updated all service routes to v2 API structure
- 📚 **Enhanced OpenAPI 3.0.3 Specification** - Complete API documentation with v2 endpoints
  - Security schemas for JWT authentication
  - Comprehensive request/response examples
  - Admin API documentation
- 🧪 **Comprehensive Test Coverage** - Extensive test suite for v2 architecture
  - Integration tests for admin API authentication
  - Unit tests for JWT middleware
  - Service lifecycle testing with v2 routes

### Changed

- 🔄 **API Route Structure** - Migrated from flat routes to versioned structure
  - Service routes: `/{serviceName}` → `/api/v2/{serviceName}/{path}`
  - Admin routes: `/_admin/api` → `/admin-api/v2`
- 🔒 **Authentication Requirements** - All admin operations now require JWT authentication
- 📋 **Database API Integration** - Complete integration with database-driven API management
- 🏗️ **Service Manager State** - Enhanced service manager with v2 API compatibility
- 📖 **Documentation Structure** - Updated all documentation to reflect v2 API endpoints

### Security Enhancements

- 🛡️ **Mandatory Admin Authentication** - All admin endpoints require valid JWT tokens
- 🔐 **JWT Secret Management** - Dedicated admin JWT secret handling
- 🚫 **Unauthorized Access Prevention** - Comprehensive 401 error handling
- 🔍 **Token Validation Pipeline** - Robust JWT verification with error handling

### Developer Experience

- 📊 **Interactive API Testing** - Enhanced Swagger UI with authentication support
- 🔧 **Type-Safe Interfaces** - Improved TypeScript interfaces for JWT payloads
- 🧪 **Enhanced Testing** - Comprehensive test coverage for authentication flows
- 📚 **Updated Documentation** - Complete API documentation with v2 examples

### Technical Details

- All service endpoints migrated to `/api/v2/{serviceName}/*` pattern
- Admin endpoints consolidated under `/admin-api/v2/*` with JWT protection
- OpenAPI schema updated to version 2.0.0 with security definitions
- Database context middleware applied consistently across all routes
- JWT authentication middleware with proper error handling
- Service documentation routes updated for v2 compatibility

### Breaking Changes

⚠️ **API Version Upgrade**: This is a major version bump with breaking changes:

- **Service Endpoints**: Update from `/{serviceName}` to `/api/v2/{serviceName}`
- **Admin Endpoints**: Update from `/_admin/api` to `/admin-api/v2`
- **Authentication Required**: All admin operations now require JWT authentication
- **Documentation Routes**: Service docs moved to `/api/docs/{serviceName}`

### Migration Guide

1. **Update Service Calls**: Replace `/{serviceName}` with `/api/v2/{serviceName}`
2. **Update Admin Calls**: Replace `/_admin/api` with `/admin-api/v2`
3. **Add Authentication**: Include JWT tokens in Authorization headers for admin operations
4. **Update Documentation Access**: Use `/api/docs/{serviceName}` for service documentation

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
