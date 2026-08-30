import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Fab,
  Paper,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  CircularProgress,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { chatService } from '../../services/chatService';
import { ChatMessage, ChatProduct } from '../../types';

interface DisplayMessage extends ChatMessage {
  products?: ChatProduct[];
}

const ChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const historyForApi = (): ChatMessage[] =>
    messages.map(({ role, content }) => ({ role, content }));

  const handleSend = async () => {
    const message = input.trim();
    if (!message || loading) {
      return;
    }

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setLoading(true);

    try {
      const { reply, products } = await chatService.send(message, historyForApi());
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, products },
      ]);
    } catch (err) {
      console.error('[ChatWidget] Chat request failed:', err);
      setError('Sorry, the assistant is unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Fab
        color="secondary"
        aria-label="open shopping assistant"
        onClick={() => setOpen((value) => !value)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1300,
        }}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </Fab>

      {open && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            bottom: 96,
            right: 24,
            width: { xs: 'calc(100% - 32px)', sm: 380 },
            height: 520,
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f0f0f0' }}>
            <Typography variant="h6">Shopping Assistant</Typography>
            <Typography variant="caption">Ask about products in the boutique</Typography>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1 }}>
            {messages.length === 0 && (
              <Typography variant="body2" sx={{ mt: 2 }}>
                Try “Show me silk dresses”
              </Typography>
            )}
            <List disablePadding>
              {messages.map((item, index) => (
                <ListItem
                  key={`${item.role}-${index}`}
                  sx={{
                    display: 'block',
                    px: 0,
                    alignItems: 'flex-start',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    {item.role === 'user' ? 'You' : 'Assistant'}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {item.content}
                  </Typography>
                  {item.products?.map((product) => (
                    <Paper
                      key={product.id}
                      variant="outlined"
                      sx={{ mt: 1, p: 1.5, cursor: 'pointer' }}
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      <Typography variant="subtitle2">{product.name}</Typography>
                      {product.price != null && (
                        <Typography variant="body2">
                          ${Number(product.price).toFixed(2)}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </ListItem>
              ))}
            </List>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={22} />
              </Box>
            )}
            {error && (
              <Typography variant="body2" color="error" sx={{ py: 1 }}>
                {error}
              </Typography>
            )}
            <div ref={endRef} />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderTop: '1px solid #f0f0f0' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ask about silk dresses..."
              value={input}
              disabled={loading}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <IconButton
              color="primary"
              aria-label="send message"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      )}
    </>
  );
};

export default ChatWidget;
