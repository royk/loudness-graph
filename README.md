# Loudness Graph - Album Analyzer

A browser-based TypeScript application for analyzing audio loudness across album mixdowns. Visualize peak amplitude and LUFS (Loudness Units relative to Full Scale) over time to ensure consistent loudness levels across your tracks.

## Features

- **Audio File Support**: MP3, WAV, FLAC, M4A, and other browser-supported formats
- **Drag & Drop Interface**: Easy file upload with visual feedback
- **Real-time Analysis**: Process multiple audio files with progress tracking
- **Dual Metrics**: Visualize both peak amplitude (dB) and LUFS over time
- **Interactive Graph**: Canvas-based visualization with grid and labels
- **Statistics Dashboard**: Key metrics including average LUFS, peak levels, and ranges
- **Data Export**: Export analysis results as JSON for further processing
- **Responsive Design**: Works on desktop and mobile devices

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd loudness-graph
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Usage

1. **Upload Audio Files**:
   - Drag and drop audio files onto the upload area, or
   - Click "Choose Audio Files" to browse and select files
   - Supports multiple file selection for batch processing

2. **View Analysis**:
   - The application will process each file and display progress
   - Once complete, a graph will show peak amplitude and LUFS over time
   - Statistics cards display key metrics for the entire album

3. **Interpret Results**:
   - **Peak Amplitude (Blue line)**: Shows the maximum amplitude at each time point
   - **LUFS (Purple line)**: Shows the perceived loudness using EBU R128 standards
   - **Statistics**: Average values, ranges, and totals for the entire album

4. **Export Data**:
   - Click "Export Data" to download analysis results as JSON
   - Use this data for further analysis or integration with other tools

## Technical Details

### Audio Processing
- Uses Web Audio API for audio decoding and analysis
- Processes audio in 100ms windows for time-based analysis
- Calculates peak amplitude, RMS, and simplified LUFS values

### LUFS Calculation
The current implementation uses a simplified LUFS calculation with proper window sizing:
- **3-second sliding windows** for short-term LUFS approximation
- Based on RMS values with frequency weighting approximation
- Includes gate threshold (-70 dB) for silence detection
- Typically 10-15 dB lower than RMS values
- For production use, consider implementing full EBU R128 compliance

### Performance
- Optimized for large audio files and multiple file processing
- Uses efficient algorithms for real-time analysis
- Canvas-based rendering for smooth visualization

## Development

### Project Structure
```
src/
├── main.ts           # Application entry point
├── AudioAnalyzer.ts  # Audio processing and analysis
├── GraphRenderer.ts  # Canvas-based visualization
└── UIManager.ts      # User interface management
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking

### Technologies Used
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Web Audio API** - Audio processing
- **Canvas API** - Graphics rendering
- **Modern CSS** - Responsive design

## Browser Compatibility

- Chrome 66+
- Firefox 60+
- Safari 14+
- Edge 79+

Requires Web Audio API support for audio processing.

## Limitations

- **LUFS Calculation**: Current implementation is simplified; for professional use, implement full EBU R128 compliance
- **File Size**: Large audio files may take time to process
- **Browser Memory**: Very large files may exceed browser memory limits
- **Audio Format Support**: Limited to browser-supported audio formats

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Web Audio API for audio processing capabilities
- EBU R128 standard for loudness measurement
- Canvas API for efficient graphics rendering 