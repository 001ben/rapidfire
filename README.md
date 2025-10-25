# RapidFire - Mosaic + Observable Framework

An interactive data exploration tool built with Mosaic and Observable Framework, allowing users to transform and visualize data using Arquero queries and Mosaic visualizations.

## Features

- Interactive data transformation using Arquero
- Real-time visualization with Mosaic
- Responsive design that adapts to container dimensions
- Context-aware column operations (filter, select, group, cast)
- Multiple plot types (bar charts, scatter plots, heatmaps, histograms)
- Observable Framework reactive programming model

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview built site
npm run preview

# Deploy to Observable
npm run deploy
```

## Project Structure

- `app/index.md` - Main application page
- `app/_layout.css` - Application styling
- `observablehq.config.js` - Framework configuration
- `package.json` - Dependencies and scripts

## Architecture

This application converts the original vanilla JavaScript RapidFire app to use:

- **Observable Framework** for reactive data flow and UI components
- **Mosaic/VGPlot** for interactive visualizations
- **Arquero** for data transformation
- **Observable Inputs** for interactive UI elements

## Key Differences from Original

- Uses Observable's reactive programming model instead of manual DOM manipulation
- Leverages Mosaic for coordinated visualizations
- Built-in responsive design and styling
- Simplified state management through Observable generators
- Automatic dependency management through npm
