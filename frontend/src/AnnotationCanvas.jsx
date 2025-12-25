import React, { useEffect, useRef, useState } from 'react';

// Simplified version for demo - would use react-konva in full implementation
// Here we use standard Canvas API for simplicity in "Showcase" mode
export default function AnnotationCanvas({ imageUrl, initialRegions = [], onChange }) {
    const canvasRef = useRef(null);
    const [regions, setRegions] = useState(initialRegions);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [image, setImage] = useState(null);

    // Load Image
    useEffect(() => {
        if (imageUrl) {
            const img = new Image();
            img.src = imageUrl;
            img.onload = () => {
                setImage(img);
                draw(img, regions);
            };
        }
    }, [imageUrl]);

    // Sync input props (Sidebar changes) to local state
    useEffect(() => {
        setRegions(initialRegions);
        if (image) {
            draw(image, initialRegions);
        }
    }, [initialRegions, image]);

    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const draw = (currentImage, currentRegions, tempRect = null) => {
        const canvas = canvasRef.current;
        if (!canvas || !currentImage) return;
        const ctx = canvas.getContext('2d');

        // Clear and draw background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

        // Draw existing regions
        currentRegions.forEach(r => drawRect(ctx, r, false));

        // Draw temp rect (dragging)
        if (tempRect) {
            drawRect(ctx, tempRect, true);
        }
    };

    const drawRect = (ctx, rect, isTemp) => {
        ctx.beginPath();
        ctx.strokeStyle = '#ec4899'; // Pink-500
        ctx.lineWidth = 2;
        if (!isTemp) {
            ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }
        // Dashed line for temp
        if (isTemp) ctx.setLineDash([5, 5]);
        else ctx.setLineDash([]);

        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.stroke();

        // Draw label
        if (rect.label) {
            ctx.fillStyle = '#ec4899';
            ctx.fillRect(rect.x, rect.y - 20, ctx.measureText(rect.label).width + 10, 20);
            ctx.fillStyle = 'white';
            ctx.font = '12px Inter';
            ctx.fillText(rect.label, rect.x + 5, rect.y - 5);
        }
    };

    const handleMouseDown = (e) => {
        const pos = getPos(e);
        setStartPos(pos);
        setIsDrawing(true);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing || !image) return;
        const pos = getPos(e);
        const tempRect = {
            x: Math.min(startPos.x, pos.x),
            y: Math.min(startPos.y, pos.y),
            width: Math.abs(pos.x - startPos.x),
            height: Math.abs(pos.y - startPos.y)
        };
        draw(image, regions, tempRect);
    };

    const handleMouseUp = (e) => {
        if (!isDrawing || !image) return;
        const pos = getPos(e);
        setIsDrawing(false);

        // Only add if reasonable size
        if (Math.abs(pos.x - startPos.x) > 10 && Math.abs(pos.y - startPos.y) > 10) {
            const newRegion = {
                id: Date.now(),
                label: 'New Region',
                x: Math.min(startPos.x, pos.x),
                y: Math.min(startPos.y, pos.y),
                width: Math.abs(pos.x - startPos.x),
                height: Math.abs(pos.y - startPos.y)
            };
            const updated = [...regions, newRegion];
            setRegions(updated);
            draw(image, updated);
            onChange?.(updated);
        }
    };

    return (
        <div className="relative w-full h-full flex justify-center items-center bg-slate-950/30 rounded-xl overflow-hidden custom-scrollbar">
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="bg-white shadow-2xl cursor-crosshair rounded border border-slate-700 touch-none max-w-full h-auto"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            />
        </div>
    );
}
