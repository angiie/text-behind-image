'use client'

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ModeToggle } from '@/components/mode-toggle';
import { ReloadIcon } from '@radix-ui/react-icons';
import { removeBackground } from "@imgly/background-removal";
import SliderField from '@/components/editor/slider-field';

const RemoveBgPage = () => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    
    // Eraser states
    const [brushSize, setBrushSize] = useState<number>(30);
    const [isErasing, setIsErasing] = useState<boolean>(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleUploadImage = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // 清理旧状态
            setIsProcessing(true);
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            const imageUrl = URL.createObjectURL(file);
            setSelectedImage(imageUrl);
            await setupImage(imageUrl);
        }
    };

    const setupImage = async (imageUrl: string) => {
        setIsProcessing(true);
        try {
            // 抠图
            const imageBlob = await removeBackground(imageUrl);
            const url = URL.createObjectURL(imageBlob);
            
            // 把抠出来的图画到 Canvas 上，以便于用户擦除
            const img = new (window as any).Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                setIsProcessing(false);
            };
            img.src = url;
            
        } catch (error) {
            console.error(error);
            setIsProcessing(false);
        }
    };

    const getMousePos = (canvas: HTMLCanvasElement, evt: React.MouseEvent | React.TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        
        let clientX = 0;
        let clientY = 0;

        if ('touches' in evt) {
            clientX = evt.touches[0].clientX;
            clientY = evt.touches[0].clientY;
        } else {
            clientX = (evt as React.MouseEvent).clientX;
            clientY = (evt as React.MouseEvent).clientY;
        }

        // Calculate scaling ratio
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startErasing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsErasing(true);
        erase(e);
    };

    const stopErasing = () => {
        setIsErasing(false);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.beginPath(); // 重置路径，防止和下次连起来
        }
    };

    const erase = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isErasing || !canvasRef.current) return;
        e.preventDefault();
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pos = getMousePos(canvas, e);

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // 使用 destination-out 模式，画过的地方会变成透明
        ctx.globalCompositeOperation = 'destination-out';

        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const saveImage = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'removed-bg-edited.png';
        link.href = dataUrl;
        link.click();
    };

    return (
        <div className='flex flex-col h-screen'>
            <header className='flex flex-row items-center justify-between p-5 px-10'>
                <div className="flex items-center gap-4">
                    <Link href="/app" className="text-sm text-muted-foreground hover:underline">
                        &larr; Back to Editor
                    </Link>
                    <h2 className="text-4xl md:text-2xl font-semibold tracking-tight">
                        <span className="hidden md:block">Background Remover & Eraser</span>
                    </h2>
                </div>
                
                <div className='flex gap-4 items-center'>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        accept=".jpg, .jpeg, .png"
                    />
                    <div className='flex gap-2'>
                        <Button onClick={handleUploadImage}>
                            Upload image
                        </Button>
                        {selectedImage && !isProcessing && (
                            <Button onClick={saveImage} variant="default">
                                Save PNG
                            </Button>
                        )}
                    </div>
                    <ModeToggle />
                </div>
            </header>
            <Separator /> 
            
            <div className='flex flex-col md:flex-row items-start justify-start gap-10 w-full h-full px-10 mt-2 pb-10'>
                <div className="flex flex-col items-center justify-center w-full md:w-3/4 h-full gap-4 relative">
                    {!selectedImage && (
                        <div className='flex items-center justify-center h-full w-full'>
                            <h2 className="text-xl font-semibold">Upload an image to remove background</h2>
                        </div>
                    )}
                    
                    {isProcessing && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50">
                            <span className='flex items-center gap-2 bg-background p-4 rounded-lg shadow-lg'>
                                <ReloadIcon className='animate-spin' /> Removing Background...
                            </span>
                        </div>
                    )}

                    <div 
                        ref={containerRef}
                        className={`w-full h-full p-4 border border-border rounded-lg relative overflow-hidden flex items-center justify-center ${selectedImage ? '' : 'hidden'}`}
                        // Checkerboard pattern for transparency visualization
                        style={{
                            backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(135deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(135deg, transparent 75%, #ccc 75%)',
                            backgroundSize: '20px 20px',
                            backgroundPosition: '0 0, 10px 0, 10px -10px, 0px 10px'
                        }}
                    >
                        {/* 我们直接显示带有交互事件的 Canvas */}
                        <canvas 
                            ref={canvasRef}
                            onMouseDown={startErasing}
                            onMouseMove={erase}
                            onMouseUp={stopErasing}
                            onMouseLeave={stopErasing}
                            onTouchStart={startErasing}
                            onTouchMove={erase}
                            onTouchEnd={stopErasing}
                            onTouchCancel={stopErasing}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                cursor: 'crosshair',
                                touchAction: 'none' // 防止移动端滚动
                            }}
                        />
                    </div>
                </div>
                
                <div className='flex flex-col w-full md:w-1/4 pt-10'>
                    {selectedImage && !isProcessing && (
                        <div className="bg-secondary/30 p-6 rounded-xl border border-border">
                            <h3 className="text-lg font-semibold mb-4">Eraser Tool</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Click and drag on the image to erase remaining parts of the background or foreground.
                            </p>
                            <SliderField
                                attribute="brushSize"
                                label={`Brush Size: ${brushSize}px`}
                                min={5}
                                max={200}
                                step={1}
                                currentValue={brushSize}
                                handleAttributeChange={(_, value) => setBrushSize(value)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RemoveBgPage;