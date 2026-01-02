# VietLMS Presenter

Ứng dụng trình chiếu bài giảng tương tác cho giáo viên Toán, hỗ trợ render LaTeX/TikZ và điều khiển từ xa qua điện thoại.

## ✨ Tính năng

- **Render LaTeX/KaTeX** - Hiển thị công thức toán học
- **TikZ Graphics** - Compile và hiển thị đồ thị TikZ (bảng xét dấu, đồ thị hàm số...)
- **Step-by-step Reveal** - Hiện lời giải từng bước
- **Annotation/Drawing** - Vẽ, đánh dấu trên slides
- **Remote Control** - Điều khiển từ điện thoại qua mạng LAN
- **Whiteboard Mode** - Bảng phụ để giảng bài
- **Timer** - Đồng hồ đếm ngược cho bài tập
- **Hot Reload** - Tự động cập nhật khi file .tex thay đổi

## 📋 Yêu cầu

- **Node.js** 18+
- **MiKTeX** hoặc **TeX Live** (cho TikZ graphics)

### Cài đặt MiKTeX (Windows)

1. Tải từ https://miktex.org/download
2. Cài đặt với đường dẫn mặc định:
   - `C:\Program Files\MiKTeX\miktex\bin\x64`
3. Ứng dụng sẽ tự động detect

## 🚀 Chạy ứng dụng

```bash
# Cài đặt dependencies
npm install

# Chạy development mode
npm run electron:dev

# Build production
npm run electron:build
```

## 📁 Format File .tex

File `.tex` cần tuân theo format VietLMS với các environments:

```latex
% Câu trắc nghiệm
\begin{ex}
  Nội dung câu hỏi $x^2+1$.
  \choice{Đáp án A}{\True Đáp án B đúng}{Đáp án C}{Đáp án D}
  \loigiai{
    Lời giải từng bước...
  }
\end{ex}

% Câu đúng sai
\begin{ex}
  Nội dung câu hỏi.
  \choiceTF
  {\True Mệnh đề đúng}
  {Mệnh đề sai}
  ...
\end{ex}

% Lý thuyết
\begin{boxdn}
  Định nghĩa/công thức...
\end{boxdn}

% TikZ (bảng xét dấu)
\begin{tikzpicture}
  \tkzTabInit{...}{...}
  \tkzTabLine{...}
\end{tikzpicture}
```

## ⌨️ Phím tắt

| Phím | Chức năng |
|------|-----------|
| `Space` | Kiểm tra đáp án → Hiện lời giải → Next step |
| `←` `→` | Chuyển slide trước/sau |
| `A` | Toggle annotation mode |
| `W` | Toggle whiteboard |
| `L` | Toggle laser pointer |
| `T` | Toggle timer |

## 📱 Điều khiển từ xa

1. Click icon 📱 trên toolbar
2. Quét QR code bằng điện thoại
3. Điện thoại sẽ hiển thị remote control interface

**Lưu ý**: Điện thoại và máy tính cần cùng mạng WiFi.

## 📂 Cấu trúc thư mục

```
apps/presenter/
├── electron/           # Electron main process
│   ├── main.ts         # IPC handlers, window management
│   ├── remote-server.ts# HTTP server cho remote control
│   └── tikz-compiler.ts# Compile TikZ → SVG
├── src/
│   ├── App.tsx         # Main React component
│   ├── hooks/          # Custom React hooks
│   ├── components/     # UI components
│   └── services/       # Parser và utilities
└── sample-data/        # File .tex mẫu để test
```

## 🔧 Custom Hooks (cho developers)

Các hooks đã được tách ra để dễ maintain:

- `useTheme` - Quản lý theme (light/sepia/dark)
- `useSlides` - Navigation, file loading, answer checking
- `useKeyboard` - Keyboard event handling
- `useAnnotations` - Annotation/whiteboard persistence

## 📄 License

MIT
