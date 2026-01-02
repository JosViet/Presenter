/**
 * Utility for generating perfect geometric points from start and end points.
 */

export interface Point {
    x: number;
    y: number;
}

export class ShapeGenerator {
    static generateLine(start: Point, end: Point): Point[] {
        return this.densifyLine(start, end, 20); // Densify lines too for better quality
    }

    // Helper: Add intermediate points to force straight lines in smoothed canvas
    private static densifyLine(start: Point, end: Point, steps: number): Point[] {
        const points: Point[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            points.push({
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t
            });
        }
        return points;
    }

    static generateEllipse(start: Point, end: Point): Point[] {
        const center = {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2
        };
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;

        const points: Point[] = [];
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push({
                x: center.x + Math.cos(angle) * rx,
                y: center.y + Math.sin(angle) * ry
            });
        }
        return points;
    }

    static generateRectangle(start: Point, end: Point): Point[] {
        // Generate 4 corners
        const tl = { x: start.x, y: start.y };
        const tr = { x: end.x, y: start.y };
        const br = { x: end.x, y: end.y };
        const bl = { x: start.x, y: end.y };

        // Densify distinct sides to prevent "blob" effect
        return [
            ...this.densifyLine(tl, tr, 10),
            ...this.densifyLine(tr, br, 10),
            ...this.densifyLine(br, bl, 10),
            ...this.densifyLine(bl, tl, 10)
        ];
    }

    static generateArrow(start: Point, end: Point): Point[] {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);

        // Proportions
        const headLength = Math.min(25, length * 0.35); // Slightly larger head
        const headAngle = Math.PI / 7; // Sharper angle (approx 25 degrees)


        // Calculate wing tips
        const wing1 = {
            x: end.x - headLength * Math.cos(angle - headAngle),
            y: end.y - headLength * Math.sin(angle - headAngle)
        };
        const wing2 = {
            x: end.x - headLength * Math.cos(angle + headAngle),
            y: end.y - headLength * Math.sin(angle + headAngle)
        };

        // Generate dense paths for all 3 components to ensure they render straight
        // 1. Main Shaft (start -> end)
        // 2. Wing 1 (end -> wing1)
        // 3. Wing 2 (end -> wing2)
        // Note: SketchCanvas works best with a continuous stroke, so we backtrack.
        // Path: Start -> End -> Wing1 -> End -> Wing2

        return [
            ...this.densifyLine(start, end, 20),      // Shaft
            ...this.densifyLine(end, wing1, 10),      // Wing 1
            ...this.densifyLine(wing1, end, 5),       // Backtrack to tip
            ...this.densifyLine(end, wing2, 10)       // Wing 2
        ];
    }

    static generateTriangle(start: Point, end: Point): Point[] {
        // Bounding box logic
        const topX = (start.x + end.x) / 2;
        const topY = Math.min(start.y, end.y);
        const bottomY = Math.max(start.y, end.y);
        const leftX = Math.min(start.x, end.x);
        const rightX = Math.max(start.x, end.x);

        // Vertices
        const v1 = { x: topX, y: topY };            // Top Center
        const v2 = { x: rightX, y: bottomY };       // Bottom Right
        const v3 = { x: leftX, y: bottomY };        // Bottom Left

        return [
            ...this.densifyLine(v1, v2, 15),
            ...this.densifyLine(v2, v3, 15),
            ...this.densifyLine(v3, v1, 15)
        ];
    }
}
