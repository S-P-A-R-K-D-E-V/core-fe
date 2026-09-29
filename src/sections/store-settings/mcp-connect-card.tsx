'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

import {
  mcpUrl,
  copyText,
  mcpPrompt,
  mcpSnippet,
  MCP_CLIENTS,
  type McpClientId,
  MCP_PROMPT_TARGETS,
  type McpPromptTarget,
} from './mcp-connect';

// ----------------------------------------------------------------------
// Thẻ "Kết nối MCP": URL MCP của cửa hàng này, nút sao chép prompt (dán cho Claude / Cursor… để
// agent tự cấu hình) và cấu hình mẫu theo công cụ. Không chứa khoá: prompt để chỗ <API_KEY>; khoá
// thật chỉ có ở hộp thoại lúc vừa tạo ("Sao chép prompt kèm khoá").

export function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          pr: 5,
          borderRadius: 1,
          bgcolor: 'background.neutral',
          typography: 'caption',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {text}
      </Box>
      <Tooltip title={copied ? 'Đã sao chép' : 'Sao chép'}>
        <IconButton
          size="small"
          aria-label="Sao chép"
          onClick={async () => setCopied(await copyText(text))}
          sx={{ position: 'absolute', top: 4, right: 4 }}
        >
          <Iconify icon={copied ? 'eva:checkmark-fill' : 'solar:copy-bold'} width={18} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/**
 * Chọn loại prompt (Mặc định / Claude Code / Claude Desktop / Cursor / OpenClaw / Agent khác) rồi
 * sao chép. Không truyền apiKey thì prompt để chỗ <API_KEY>.
 */
export function McpPromptCopy({
  storeName,
  serverName,
  url,
  apiKey,
  target,
  onTargetChange,
  label = 'Sao chép prompt hướng dẫn',
}: {
  storeName: string;
  serverName: string;
  url: string;
  apiKey?: string;
  target: McpPromptTarget;
  onTargetChange: (target: McpPromptTarget) => void;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    setCopied(await copyText(mcpPrompt(storeName, serverName, url, apiKey, target)));
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        select
        size="small"
        label="Prompt cho"
        value={target}
        onChange={(e) => onTargetChange(e.target.value as McpPromptTarget)}
        sx={{ minWidth: 190 }}
      >
        {MCP_PROMPT_TARGETS.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant="contained"
        size="small"
        sx={{ flexShrink: 0, height: 40 }}
        startIcon={<Iconify icon={copied ? 'eva:checkmark-fill' : 'solar:copy-bold'} />}
        onClick={copy}
      >
        {copied ? 'Đã sao chép' : label}
      </Button>
    </Stack>
  );
}

type Props = { origin: string; storeName: string; serverName: string };

export function McpConnectCard({ origin, storeName, serverName }: Props) {
  const url = mcpUrl(origin);
  const [client, setClient] = useState<McpClientId>('claude-code');
  const [target, setTarget] = useState<McpPromptTarget>('default');
  const current = MCP_CLIENTS.find((c) => c.id === client)!;

  return (
    <Card>
      <CardHeader
        title="Kết nối MCP"
        subheader="Cho agent ngoài (Claude, Cursor, OpenClaw…) làm việc với dữ liệu của cửa hàng này qua MCP, bằng khoá API bên dưới — chỉ trong phạm vi quyền của khoá. Mọi phiên và lượt gọi được ghi ở mục Phiên gần đây."
        action={
          <McpPromptCopy
            storeName={storeName}
            serverName={serverName}
            url={url}
            target={target}
            onTargetChange={setTarget}
          />
        }
        sx={{
          flexWrap: 'wrap',
          rowGap: 2,
          '& .MuiCardHeader-action': { alignSelf: 'center', m: 0 },
        }}
      />
      <Box sx={{ p: 3, pt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
          URL MCP server
        </Typography>
        <CodeBlock text={url} />

        <Alert severity="info" sx={{ mt: 2 }}>
          Chọn loại prompt rồi dán vào Claude Code, Cursor, OpenClaw… — agent sẽ tự thêm MCP server.
          Prompt để chỗ <code>&lt;API_KEY&gt;</code>: tạo khoá ở bảng bên dưới (nên chọn{' '}
          <b>Chỉ đọc</b> cho agent hỏi đáp) rồi điền vào, hoặc dùng nút &quot;Sao chép prompt kèm
          khoá&quot; ngay khi tạo. Khoá chỉ dùng được tại <code>{origin}</code>.
        </Alert>

        <Tabs
          value={client}
          onChange={(_, v) => setClient(v)}
          variant="scrollable"
          sx={{ mt: 2, mb: 1.5 }}
        >
          {MCP_CLIENTS.map((c) => (
            <Tab key={c.id} value={c.id} label={c.label} />
          ))}
        </Tabs>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          {current.hint}
        </Typography>
        <CodeBlock text={mcpSnippet(client, serverName, url)} />
      </Box>
    </Card>
  );
}
