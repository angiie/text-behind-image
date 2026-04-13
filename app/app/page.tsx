// app/app/page.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { useUser } from '@/hooks/useUser';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';
import { Accordion } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModeToggle } from '@/components/mode-toggle';
import { Profile } from '@/types';
import Authenticate from '@/components/authenticate';
import TextCustomizer from '@/components/editor/text-customizer';

import Link from 'next/link';

import { PlusIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Trash2, RotateCw, Axis3d, Move3d } from 'lucide-react';

import { removeBackground } from "@imgly/background-removal";

import '@/app/fonts.css';
import PayDialog from '@/components/pay-dialog';
import AppAds from '@/components/editor/app-ads';
import BrowserCashAd from '@/ads/browsercash';

const Page = () => {
    const { user } = useUser();
    const { session } = useSessionContext();
    const supabaseClient = useSupabaseClient();
    const [currentUser, setCurrentUser] = useState<Profile>({
        id: 'mock-pro-user',
        paid: true,
        images_generated: 0,
        full_name: 'Pro User',
        avatar_url: ''
    } as any)

    const [draggingTextId, setDraggingTextId] = useState<number | null>(null);
    const [hoveredTextId, setHoveredTextId] = useState<number | null>(null);
    const [dragStartPos, setDragStartPos] = useState<{x: number, y: number} | null>(null);
    const [dragStartTextPos, setDragStartTextPos] = useState<{left: number, top: number} | null>(null);

    // 新增缩放相关状态
    const [resizingTextId, setResizingTextId] = useState<number | null>(null);
    const [resizeStartPos, setResizeStartPos] = useState<{x: number, y: number} | null>(null);
    const [resizeStartFontSize, setResizeStartFontSize] = useState<number | null>(null);

    // 新增旋转/倾斜相关状态
    const [rotatingTextId, setRotatingTextId] = useState<number | null>(null);
    const [tiltingXTextId, setTiltingXTextId] = useState<number | null>(null);
    const [tiltingYTextId, setTiltingYTextId] = useState<number | null>(null);
    
    // 交互起始状态
    const [interactionStartPos, setInteractionStartPos] = useState<{x: number, y: number} | null>(null);
    const [interactionStartVal, setInteractionStartVal] = useState<number | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isImageSetupDone, setIsImageSetupDone] = useState<boolean>(false);
    const [removedBgImageUrl, setRemovedBgImageUrl] = useState<string | null>(null);
    const [textSets, setTextSets] = useState<Array<any>>([]);
    const [isPayDialogOpen, setIsPayDialogOpen] = useState<boolean>(false); 
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const getCurrentUser = async (userId: string) => {
        try {
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)

            if (error) {
                throw error;
            }

            if (profile) {
                setCurrentUser(profile[0]);
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    };

    const handleUploadImage = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // 清理旧状态，显示 loading
            setIsImageSetupDone(false);
            setRemovedBgImageUrl(null);
            
            const imageUrl = URL.createObjectURL(file);
            setSelectedImage(imageUrl);
            await setupImage(imageUrl);
        }
    };

    const setupImage = async (imageUrl: string) => {
        try {
            const imageBlob = await removeBackground(imageUrl);
            const url = URL.createObjectURL(imageBlob);
            setRemovedBgImageUrl(url);
            setIsImageSetupDone(true);

            if (currentUser) {
                await supabaseClient
                    .from('profiles')
                    .update({ images_generated: currentUser.images_generated + 1 })
                    .eq('id', currentUser.id) 
                    .select();
            }
            
        } catch (error) {
            console.error(error);
        }
    };

    const addNewTextSet = () => {
        const newId = Math.max(...textSets.map(set => set.id), 0) + 1;
        setTextSets(prev => [...prev, {
            id: newId,
            text: 'edit',
            fontFamily: 'Inter',
            top: 0,
            left: 0,
            color: 'white',
            fontSize: 200,
            fontWeight: 800,
            opacity: 1,
            shadowColor: 'rgba(0, 0, 0, 0.8)',
            shadowSize: 4,
            rotation: 0,
            tiltX: 0,
            tiltY: 0,
            letterSpacing: 0
        }]);
    };

    const handleAttributeChange = (id: number, attribute: string, value: any) => {
        setTextSets(prev => prev.map(set => 
            set.id === id ? { ...set, [attribute]: value } : set
        ));
    };

    const duplicateTextSet = (textSet: any) => {
        const newId = Math.max(...textSets.map(set => set.id), 0) + 1;
        setTextSets(prev => [...prev, { ...textSet, id: newId }]);
    };

    const removeTextSet = (id: number) => {
        setTextSets(prev => prev.filter(set => set.id !== id));
    };

    const saveRemovedBgImage = () => {
        if (!canvasRef.current || !removedBgImageUrl || !isImageSetupDone) return;
    
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const bgImg = new (window as any).Image();
        bgImg.crossOrigin = "anonymous";
        bgImg.onload = () => {
            canvas.width = bgImg.width;
            canvas.height = bgImg.height;
            
            // 清空画布，保证背景透明
            ctx.clearRect(0, 0, canvas.width, canvas.height);
    
            const removedBgImg = new (window as any).Image();
            removedBgImg.crossOrigin = "anonymous";
            removedBgImg.onload = () => {
                ctx.drawImage(removedBgImg, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = 'removed-bg-image.png';
                link.href = dataUrl;
                link.click();
            };
            removedBgImg.src = removedBgImageUrl;
        };
        // 用原图来获取宽高
        bgImg.src = selectedImage || '';
    };

    const saveCompositeImage = () => {
        if (!canvasRef.current || !isImageSetupDone) return;
    
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const bgImg = new (window as any).Image();
        bgImg.crossOrigin = "anonymous";
        bgImg.onload = () => {
            canvas.width = bgImg.width;
            canvas.height = bgImg.height;
    
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    
            textSets.forEach(textSet => {
                ctx.save();
                
                // Set up text properties
                ctx.font = `${textSet.fontWeight} ${textSet.fontSize * 3}px ${textSet.fontFamily}`;
                ctx.fillStyle = textSet.color;
                ctx.globalAlpha = textSet.opacity;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.letterSpacing = `${textSet.letterSpacing}px`;
    
                const x = canvas.width * (textSet.left + 50) / 100;
                const y = canvas.height * (50 - textSet.top) / 100;
    
                // Move to position first
                ctx.translate(x, y);
                
                // Apply 3D transforms
                const tiltXRad = (-textSet.tiltX * Math.PI) / 180;
                const tiltYRad = (-textSet.tiltY * Math.PI) / 180;
    
                // Use a simpler transform that maintains the visual tilt
                ctx.transform(
                    Math.cos(tiltYRad),          // Horizontal scaling
                    Math.sin(0),          // Vertical skewing
                    -Math.sin(0),         // Horizontal skewing
                    Math.cos(tiltXRad),          // Vertical scaling
                    0,                           // Horizontal translation
                    0                            // Vertical translation
                );
    
                // Apply rotation last
                ctx.rotate((textSet.rotation * Math.PI) / 180);
    
                if (textSet.letterSpacing === 0) {
                    // Use standard text rendering if no letter spacing
                    ctx.fillText(textSet.text, 0, 0);
                } else {
                    // Manual letter spacing implementation
                    const chars = textSet.text.split('');
                    let currentX = 0;
                    // Calculate total width to center properly
                    const totalWidth = chars.reduce((width, char, i) => {
                        const charWidth = ctx.measureText(char).width;
                        return width + charWidth + (i < chars.length - 1 ? textSet.letterSpacing : 0);
                    }, 0);
                    

                
                    // Start position (centered)
                    currentX = -totalWidth / 2;
                    
                    // Draw each character with spacing
                    chars.forEach((char, i) => {
                        const charWidth = ctx.measureText(char).width;
                        ctx.fillText(char, currentX + charWidth / 2, 0);
                        currentX += charWidth + textSet.letterSpacing;
                    });
                }
                ctx.restore();
            });
    
            if (removedBgImageUrl) {
                const removedBgImg = new (window as any).Image();
                removedBgImg.crossOrigin = "anonymous";
                removedBgImg.onload = () => {
                    ctx.drawImage(removedBgImg, 0, 0, canvas.width, canvas.height);
                    triggerDownload();
                };
                removedBgImg.src = removedBgImageUrl;
            } else {
                triggerDownload();
            }
        };
        bgImg.src = selectedImage || '';
    
        function triggerDownload() {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'text-behind-image.png';
            link.href = dataUrl;
            link.click();
        }
    };

    const handleMouseDown = (e: React.MouseEvent, textSetId: number) => {
        // 如果点击的是缩放控制点或删除按钮，阻止事件冒泡，不触发拖拽
        if (
            (e.target as HTMLElement).closest('.resize-handle') || 
            (e.target as HTMLElement).closest('.delete-handle') ||
            (e.target as HTMLElement).closest('.rotate-handle') ||
            (e.target as HTMLElement).closest('.tilt-x-handle') ||
            (e.target as HTMLElement).closest('.tilt-y-handle')
        ) {
            return;
        }

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        
        // 记录鼠标按下时的屏幕坐标
        setDragStartPos({ x: e.clientX, y: e.clientY });
        
        // 找到被拖拽文字的当前 left 和 top
        const textSet = textSets.find(ts => ts.id === textSetId);
        if (textSet) {
            setDragStartTextPos({ left: textSet.left, top: textSet.top });
            setDraggingTextId(textSetId);
        }
        
        e.preventDefault(); // 防止选中文本等默认行为
    };

    const handleResizeStart = (e: React.MouseEvent, textSetId: number) => {
        e.stopPropagation();
        e.preventDefault();
        setResizingTextId(textSetId);
        setResizeStartPos({ x: e.clientX, y: e.clientY });
        const textSet = textSets.find(ts => ts.id === textSetId);
        if (textSet) {
            setResizeStartFontSize(textSet.fontSize);
        }
    };

    const handleInteractionStart = (
        e: React.MouseEvent, 
        textSetId: number, 
        type: 'rotate' | 'tiltX' | 'tiltY'
    ) => {
        e.stopPropagation();
        e.preventDefault();
        
        const textSet = textSets.find(ts => ts.id === textSetId);
        if (!textSet) return;

        setInteractionStartPos({ x: e.clientX, y: e.clientY });

        if (type === 'rotate') {
            setRotatingTextId(textSetId);
            setInteractionStartVal(textSet.rotation);
        } else if (type === 'tiltX') {
            setTiltingXTextId(textSetId);
            setInteractionStartVal(textSet.tiltX);
        } else if (type === 'tiltY') {
            setTiltingYTextId(textSetId);
            setInteractionStartVal(textSet.tiltY);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        // 处理缩放逻辑
        if (resizingTextId !== null && resizeStartPos !== null && resizeStartFontSize !== null) {
            // 计算鼠标移动的距离，这里使用 x 和 y 移动的最大值来作为缩放依据，往外拖拽变大，往里变小
            const dx = e.clientX - resizeStartPos.x;
            const dy = e.clientY - resizeStartPos.y;
            
            // 可以根据距离粗略计算缩放比例，假设向右/下移动 1px 代表字体增大 1px
            const sizeChange = Math.max(dx, dy); 
            // 限制最小字体大小
            const newSize = Math.max(10, resizeStartFontSize + sizeChange);
            
            handleAttributeChange(resizingTextId, 'fontSize', newSize);
            return;
        }

        // 处理旋转逻辑
        if (rotatingTextId !== null && interactionStartPos !== null && interactionStartVal !== null) {
            const dy = e.clientY - interactionStartPos.y;
            // 右侧控制点，往上拖拽角度减小（逆时针），往下拖拽角度增大（顺时针）
            const newRotation = (interactionStartVal + dy) % 360;
            handleAttributeChange(rotatingTextId, 'rotation', newRotation);
            return;
        }

        // 处理 Tilt X 逻辑
        if (tiltingXTextId !== null && interactionStartPos !== null && interactionStartVal !== null) {
            const dy = e.clientY - interactionStartPos.y;
            // 左侧控制点，往上拖拽时文字向后仰（角度为正），往下拖拽文字前倾（角度为负）
            // 粗略计算，纵向移动 2px = 倾斜 1 度
            let newTiltX = interactionStartVal - (dy / 2);
            newTiltX = Math.max(-45, Math.min(45, newTiltX));
            handleAttributeChange(tiltingXTextId, 'tiltX', newTiltX);
            return;
        }

        // 处理 Tilt Y 逻辑
        if (tiltingYTextId !== null && interactionStartPos !== null && interactionStartVal !== null) {
            const dx = e.clientX - interactionStartPos.x;
            // 顶部控制点，往左拖拽文字向左偏（角度为负），往右拖拽文字向右偏（角度为正）
            // 粗略计算，横向移动 2px = 倾斜 1 度
            let newTiltY = interactionStartVal + (dx / 2);
            newTiltY = Math.max(-45, Math.min(45, newTiltY));
            handleAttributeChange(tiltingYTextId, 'tiltY', newTiltY);
            return;
        }

        // 处理拖拽逻辑
        if (draggingTextId === null || !dragStartPos || !dragStartTextPos) return;
        
        // 计算鼠标在屏幕上移动的距离
        const dx = e.clientX - dragStartPos.x;
        const dy = e.clientY - dragStartPos.y;

        // 将屏幕像素距离转换为百分比（相对于容器的宽高）
        const dxPercent = (dx / rect.width) * 100;
        const dyPercent = (dy / rect.height) * 100;

        // 更新 left 和 top
        // 注意：top 是从中心往上为正，往下为负（基于原来 `50 - textSet.top` 的逻辑）
        const newLeft = dragStartTextPos.left + dxPercent;
        const newTop = dragStartTextPos.top - dyPercent;

        handleAttributeChange(draggingTextId, 'left', newLeft);
        handleAttributeChange(draggingTextId, 'top', newTop);
    };

    const handleMouseUp = () => {
        setDraggingTextId(null);
        setDragStartPos(null);
        setDragStartTextPos(null);

        setResizingTextId(null);
        setResizeStartPos(null);
        setResizeStartFontSize(null);

        setRotatingTextId(null);
        setTiltingXTextId(null);
        setTiltingYTextId(null);
        setInteractionStartPos(null);
        setInteractionStartVal(null);
    };

    // useEffect(() => {
    //   if (user?.id) {
    //     getCurrentUser(user.id)
    //   }
    // }, [user])
    
    return (
        <>
            <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1609710199882100" crossOrigin="anonymous"></script>
            <div className='flex flex-col h-screen'>
                    <header className='flex flex-row items-center justify-between p-5 px-10'>
                        <h2 className="text-4xl md:text-2xl font-semibold tracking-tight">
                            <span className="block md:hidden">TBI</span>
                            <span className="hidden md:block">Text behind image editor</span>
                        </h2>
                        <div className='flex gap-4 items-center'>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                                accept=".jpg, .jpeg, .png"
                            />
                            <div className='flex items-center gap-5'>
                                <div className='hidden md:block font-semibold'>
                                    {currentUser?.paid ? (
                                        <p className='text-sm'>
                                            Unlimited generations
                                        </p>
                                    ) : (
                                        <div className='flex items-center gap-2'>
                                            <p className='text-sm'>
                                                {2 - (currentUser?.images_generated || 0)} generations left
                                            </p>
                                            <Button 
                                                variant="link" 
                                                className="p-0 h-auto text-sm text-primary hover:underline"
                                                onClick={() => setIsPayDialogOpen(true)}
                                            >
                                                Upgrade
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className='flex gap-2'>
                                    <Button onClick={handleUploadImage}>
                                        Upload image
                                    </Button>
                                    {selectedImage && (
                                        <>
                                            <Button onClick={saveRemovedBgImage} variant="secondary" className='hidden md:flex'>
                                                Save no-bg image
                                            </Button>
                                            <Link href="/remove-bg">
                                                <Button variant="outline" className='hidden md:flex border-primary text-primary'>
                                                    Eraser Tool
                                                </Button>
                                            </Link>
                                            <Button onClick={saveCompositeImage} className='hidden md:flex'>
                                                Save image
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <ModeToggle />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Avatar className="cursor-pointer">
                                        <AvatarImage src={currentUser?.avatar_url} /> 
                                        <AvatarFallback>TBI</AvatarFallback>
                                    </Avatar>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end">
                                    <DropdownMenuLabel>
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{currentUser?.full_name}</p>
                                            <p className="text-xs leading-none text-muted-foreground">{user?.user_metadata.email}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setIsPayDialogOpen(true)}>
                                        <button>{currentUser?.paid ? 'View Plan' : 'Upgrade to Pro'}</button>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>
                    <Separator /> 
                    {selectedImage ? (
                        <div className='flex flex-col md:flex-row items-start justify-start gap-10 w-full h-screen px-10 mt-2'>
                            <div className="flex flex-col items-start justify-start w-full md:w-1/2 gap-4">
                                <canvas ref={canvasRef} style={{ display: 'none' }} />
                                <div className='flex items-center gap-2'>
                                    <Button onClick={saveRemovedBgImage} variant="secondary" className='md:hidden'>
                                        Save no-bg image
                                    </Button>
                                    <Button onClick={saveCompositeImage} className='md:hidden'>
                                        Save image
                                    </Button>
                                    <div className='block md:hidden'>
                                        {currentUser?.paid ? (
                                            <p className='text-sm'>
                                                Unlimited generations
                                            </p>
                                        ) : (
                                            <div className='flex items-center gap-5'>
                                                <p className='text-sm'>
                                                    {2 - (currentUser?.images_generated || 0)} generations left
                                                </p>
                                                <Button 
                                                    variant="link" 
                                                    className="p-0 h-auto text-sm text-primary hover:underline"
                                                    onClick={() => setIsPayDialogOpen(true)}
                                                >
                                                    Upgrade
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div 
                                    className="min-h-[400px] w-[80%] p-4 border border-border rounded-lg relative overflow-hidden"
                                    ref={containerRef}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                >
                                    {isImageSetupDone ? (
                                        <Image
                                            src={selectedImage} 
                                            alt="Uploaded"
                                            layout="fill"
                                            objectFit="contain" 
                                            objectPosition="center" 
                                        />
                                    ) : (
                                        <span className='flex items-center w-full gap-2'><ReloadIcon className='animate-spin' /> Loading, please wait</span>
                                    )}
                                    {isImageSetupDone && textSets.map(textSet => (
                                        <div
                                            key={textSet.id}
                                            onMouseDown={(e) => handleMouseDown(e, textSet.id)}
                                            onMouseEnter={() => setHoveredTextId(textSet.id)}
                                            onMouseLeave={() => setHoveredTextId(null)}
                                            style={{
                                                position: 'absolute',
                                                top: `${50 - textSet.top}%`,
                                                left: `${textSet.left + 50}%`,
                                                transform: `
                                                    translate(-50%, -50%) 
                                                    perspective(1000px)
                                                    rotateX(${textSet.tiltX}deg)
                                                    rotateY(${textSet.tiltY}deg)
                                                    rotate(${textSet.rotation}deg)
                                                `,
                                                color: textSet.color,
                                                textAlign: 'center',
                                                fontSize: `${textSet.fontSize}px`,
                                                fontWeight: textSet.fontWeight,
                                                fontFamily: textSet.fontFamily,
                                                opacity: textSet.opacity,
                                                letterSpacing: `${textSet.letterSpacing}px`,
                                                transformStyle: 'preserve-3d',
                                                cursor: draggingTextId === textSet.id ? 'grabbing' : 'grab',
                                                userSelect: 'none',
                                                border: (hoveredTextId === textSet.id || resizingTextId === textSet.id || rotatingTextId === textSet.id || tiltingXTextId === textSet.id || tiltingYTextId === textSet.id) ? '2px dashed #10B981' : '2px solid transparent',
                                                padding: '4px'
                                            }}
                                        >
                                            {textSet.text}
                                            {/* 控制点 - 仅在 hover 或 操作中 时显示 */}
                                            {(hoveredTextId === textSet.id || resizingTextId === textSet.id || rotatingTextId === textSet.id || tiltingXTextId === textSet.id || tiltingYTextId === textSet.id) && (
                                                <>
                                                    <div
                                                        className="resize-handle"
                                                        onMouseDown={(e) => handleResizeStart(e, textSet.id)}
                                                        style={{
                                                            position: 'absolute',
                                                            right: '-6px',
                                                            bottom: '-6px',
                                                            width: '12px',
                                                            height: '12px',
                                                            backgroundColor: '#10B981',
                                                            borderRadius: '50%',
                                                            cursor: 'se-resize',
                                                            zIndex: 10
                                                        }}
                                                    />
                                                    <div
                                                        className="delete-handle"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            removeTextSet(textSet.id);
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            right: '-14px',
                                                            top: '-14px',
                                                            width: '24px',
                                                            height: '24px',
                                                            backgroundColor: '#EF4444', // 红色
                                                            borderRadius: '50%',
                                                            cursor: 'pointer',
                                                            zIndex: 10,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white'
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </div>
                                                    
                                                    {/* 旋转控制点 (右上角) */}
                                                    <div
                                                        className="rotate-handle"
                                                        onMouseDown={(e) => handleInteractionStart(e, textSet.id, 'rotate')}
                                                        style={{
                                                            position: 'absolute',
                                                            right: '-14px',
                                                            bottom: '50%',
                                                            transform: 'translateY(50%)',
                                                            width: '24px',
                                                            height: '24px',
                                                            backgroundColor: '#3B82F6', // 蓝色
                                                            borderRadius: '50%',
                                                            cursor: 'pointer',
                                                            zIndex: 10,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white'
                                                        }}
                                                    >
                                                        <RotateCw size={14} />
                                                    </div>

                                                    {/* Tilt X 控制点 (左边中间) */}
                                                    <div
                                                        className="tilt-x-handle"
                                                        onMouseDown={(e) => handleInteractionStart(e, textSet.id, 'tiltX')}
                                                        style={{
                                                            position: 'absolute',
                                                            left: '-14px',
                                                            bottom: '50%',
                                                            transform: 'translateY(50%)',
                                                            width: '24px',
                                                            height: '24px',
                                                            backgroundColor: '#8B5CF6', // 紫色
                                                            borderRadius: '50%',
                                                            cursor: 'ew-resize',
                                                            zIndex: 10,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white'
                                                        }}
                                                    >
                                                        <Axis3d size={14} />
                                                    </div>

                                                    {/* Tilt Y 控制点 (顶部中间) */}
                                                    <div
                                                        className="tilt-y-handle"
                                                        onMouseDown={(e) => handleInteractionStart(e, textSet.id, 'tiltY')}
                                                        style={{
                                                            position: 'absolute',
                                                            left: '50%',
                                                            top: '-14px',
                                                            transform: 'translateX(-50%)',
                                                            width: '24px',
                                                            height: '24px',
                                                            backgroundColor: '#F59E0B', // 橙色
                                                            borderRadius: '50%',
                                                            cursor: 'ns-resize',
                                                            zIndex: 10,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white'
                                                        }}
                                                    >
                                                        <Move3d size={14} />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    {removedBgImageUrl && (
                                        <Image
                                            src={removedBgImageUrl}
                                            alt="Removed bg"
                                            layout="fill"
                                            objectFit="contain" 
                                            objectPosition="center" 
                                            className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                        /> 
                                    )}
                                </div>
                                {!currentUser?.paid && (
                                    <AppAds />
                                )}
                            </div>
                            <div className='flex flex-col w-full md:w-1/2'>
                                <Button variant={'secondary'} onClick={addNewTextSet}><PlusIcon className='mr-2'/> Add New Text Set</Button>
                                <ScrollArea className="h-[calc(100vh-10rem)] p-2">
                                    <Accordion type="single" collapsible className="w-full mt-2">
                                        {textSets.map(textSet => (
                                            <TextCustomizer 
                                                key={textSet.id}
                                                textSet={textSet}
                                                handleAttributeChange={handleAttributeChange}
                                                removeTextSet={removeTextSet}
                                                duplicateTextSet={duplicateTextSet}
                                                userId={currentUser?.id || ''}
                                            />
                                        ))}
                                    </Accordion>
                                </ScrollArea>
                            </div>
                        </div>
                    ) : (
                        <div className='flex items-center justify-center min-h-screen w-full'>
                            <h2 className="text-xl font-semibold">Welcome, get started by uploading an image!</h2>
                        </div>
                    )} 
                </div>
        </>
    );
}

export default Page;