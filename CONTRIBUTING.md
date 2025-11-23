# Contributing to ElectronAIChat

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/ElectronAIChat.git
cd ElectronAIChat
```

### 2. Set Up Development Environment

**Prerequisites:**
- Python 3.8+
- Node.js 16+
- Ollama (for local LLM testing)

**Install Dependencies:**
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd electron
npm install
```

**Configure:**
```bash
cd backend
cp .env.example .env
# Edit .env as needed
```

**Start Development Servers:**

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for detailed instructions.

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/fixes

Example: `feature/add-markdown-support`

### Commit Messages

Use conventional commits:

```
type(scope): description

[optional body]
[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

**Examples:**
```
feat(chat): add markdown rendering support
fix(embeddings): handle empty documents gracefully
docs(ollama): update setup instructions
```

### Pull Request Process

1. **Create a branch** from `main`
2. **Make your changes** with clear commits
3. **Test your changes** (see Testing section)
4. **Update documentation** if needed
5. **Create pull request** with description
6. **Wait for review** and address feedback

## Code Style

### Python (Backend)

**Style Guide:** PEP 8

**Key Points:**
- Use type hints where possible
- Docstrings for functions/classes
- 4 spaces for indentation
- Max line length: 120 characters

**Example:**
```python
def process_document(file_path: str, chat_id: str) -> Dict[str, Any]:
    """
    Process and embed a document for RAG.
    
    Args:
        file_path: Path to the document file
        chat_id: ID of the chat to associate with
        
    Returns:
        Dict with document metadata and embedding info
    """
    # Implementation here
    pass
```

**Linting:**
```bash
cd backend
pip install flake8
flake8 app/ --max-line-length=120
```

### TypeScript (Frontend)

**Style Guide:** ESLint + Prettier

**Key Points:**
- Use TypeScript interfaces for type safety
- Functional components with hooks
- 2 spaces for indentation
- Use async/await over .then()

**Example:**
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

async function sendMessage(message: string): Promise<ChatMessage> {
  const response = await apiClient.post('/api/chat', { message });
  return response.data;
}
```

**Linting:**
```bash
cd electron
npm run lint
```

## Testing

### Backend Tests

**Unit Tests:**
```bash
cd backend
pytest tests/
```

**Integration Tests:**
```bash
cd backend
python verify_ollama_integration.py
```

**Manual Testing:**
```bash
# Start backend
python main.py

# Test endpoints
curl http://127.0.0.1:8000/api/health
curl -X POST http://127.0.0.1:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"chatId":"test","userId":"test","message":"Hello"}'
```

### Frontend Tests

**Component Tests:**
```bash
cd electron
npm test
```

**E2E Tests:**
```bash
cd electron
npm run e2e
```

### Testing Checklist

Before submitting PR, verify:

- [ ] Backend starts without errors
- [ ] Frontend builds without errors
- [ ] Ollama integration works (if modified)
- [ ] New features have tests
- [ ] Documentation updated
- [ ] No console errors in frontend
- [ ] Linting passes

## Project Structure

```
ElectronAIChat/
├── backend/              # Python FastAPI backend
│   ├── app/             # Application modules
│   │   ├── routes/      # API endpoints
│   │   ├── config.py    # Configuration
│   │   ├── embeddings.py # LangChain/Ollama
│   │   ├── memory.py    # Mem0 integration
│   │   └── ...
│   ├── main.py          # FastAPI app entry point
│   └── requirements.txt # Python dependencies
│
├── electron/            # Electron + React frontend
│   ├── src/            # React components
│   ├── main.ts         # Electron main process
│   ├── preload.ts      # Electron preload script
│   └── package.json    # Node dependencies
│
└── docs/               # Documentation
    ├── OLLAMA_SETUP.md
    ├── QUICKSTART.md
    └── VERIFICATION.md
```

## Areas for Contribution

### High Priority

1. **Testing** - Add unit/integration tests
2. **Documentation** - Improve guides and examples
3. **Error Handling** - Better error messages
4. **Performance** - Optimize embeddings/streaming
5. **UI/UX** - Improve frontend usability

### Feature Ideas

- [ ] Export chat history to PDF/Markdown
- [ ] Multi-language support (i18n)
- [ ] Custom model configurations per chat
- [ ] Document annotation/highlighting
- [ ] Voice input/output
- [ ] Plugin system
- [ ] Dark/light theme customization
- [ ] Keyboard shortcuts
- [ ] Chat templates
- [ ] Advanced search filters

### Bug Reports

Use GitHub Issues with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- System info (OS, Python/Node versions)
- Logs (`backend/logs/app.log`)

## Ollama Integration Guidelines

When modifying Ollama integration:

1. **Test with multiple models:**
   - `phi` (small)
   - `llama3` (recommended)
   - `mistral` (balanced)

2. **Check both providers:**
   - Test with `LLM_PROVIDER=ollama`
   - Test with `LLM_PROVIDER=openai` (if applicable)

3. **Verify features:**
   - Embeddings (document upload)
   - Chat streaming
   - Memory system (Mem0)

4. **Update documentation:**
   - [OLLAMA_SETUP.md](docs/OLLAMA_SETUP.md)
   - Code comments
   - README if needed

5. **Run verification:**
   ```bash
   cd backend
   python verify_ollama_integration.py
   ```

## Code Review Guidelines

### For Contributors

- Keep PRs focused and small
- Explain reasoning in description
- Link related issues
- Respond to feedback promptly
- Test before requesting review

### For Reviewers

- Be constructive and respectful
- Test changes locally
- Check documentation updates
- Verify backward compatibility
- Approve when satisfied

## Communication

- **GitHub Issues** - Bug reports, feature requests
- **Pull Requests** - Code contributions
- **Discussions** - General questions, ideas

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see [LICENSE](LICENSE)).

## Questions?

- Check [docs/](docs/) for detailed guides
- Search existing issues/PRs
- Create new issue for clarification

## Thank You!

Your contributions help make ElectronAIChat better for everyone. We appreciate your time and effort! 🎉
