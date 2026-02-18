'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    Users, Stethoscope, FlaskConical, Wallet,
    LayoutDashboard, LogOut, Calendar, Activity,
    Settings, FileText, Image as ImageIcon, FolderArchive,
    ChevronDown, ChevronRight, ChevronLeft, Binoculars, Calculator, Menu,
    TrendingUp, TrendingDown, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { usePatientStore } from '@/stores/patient-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Footer } from './footer';

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { activePatient, setActivePatient } = usePatientStore();
    const { logoUrl, logoWidth } = useSettingsStore();

    const mainNav = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        // { href: '/patients', label: 'Hastalar', icon: Users },
        { href: '/calendar', label: 'Takvim', icon: Calendar },
    ];

    // Fetch patient record counts if an active patient is selected
    const { data: counts } = useQuery({
        queryKey: ['patientCounts', activePatient?.id],
        queryFn: () => api.patients.getCounts(activePatient!.id),
        enabled: !!activePatient?.id,
        staleTime: 30000, // 30 seconds
    });

    // Primary items - always visible
    const primaryClinicalNav = useMemo(() => [
        {
            href: activePatient ? `/patients/${activePatient.id}/examination` : '/clinical',
            label: activePatient && counts && counts.muayene > 0 ? `Muayene [${counts.muayene}]` : 'Muayene',
            icon: Stethoscope,
            activeColor: 'text-red-500'
        },
        {
            href: activePatient ? `/patients/${activePatient.id}/imaging` : '/imaging',
            label: activePatient && counts && counts.imaging > 0 ? `Görüntüleme [${counts.imaging}]` : 'Görüntüleme',
            icon: ImageIcon,
            activeColor: 'text-purple-500'
        },
        {
            href: activePatient ? `/patients/${activePatient.id}/lab` : '/lab',
            label: 'Laboratuvar',
            icon: FlaskConical,
            activeColor: 'text-cyan-500'
        },
        {
            href: activePatient ? `/patients/${activePatient.id}/followup` : '/followup',
            label: activePatient && counts && counts.followup > 0 ? `Takip [${counts.followup}]` : 'Takip',
            icon: Binoculars,
            activeColor: 'text-green-500'
        },
    ], [activePatient, counts]);

    // Secondary items - inside accordion
    const secondaryClinicalNav = useMemo(() => [
        {
            label: activePatient && counts && counts.operation > 0 ? `Operasyon [${counts.operation}]` : 'Operasyon',
            icon: Activity,
            href: '',
            activeColor: 'text-orange-500',
            children: [
                { href: activePatient ? `/patients/${activePatient.id}/operation` : '/operations', label: 'Operasyon Listesi' },
                { href: activePatient ? `/patients/${activePatient.id}/medical-report` : '/reports', label: 'Tıbbi Müdahale R.' },
            ]
        },
        {
            href: activePatient ? `/patients/${activePatient.id}/finance` : '/finance',
            label: 'Finans',
            icon: Wallet,
            activeColor: 'text-emerald-500'
        },
        // Tıbbi Raporlar (Collapsible Group)
        {
            label: 'Tıbbi Raporlar',
            icon: FileText,
            href: '', // Group header
            children: [
                { href: activePatient ? `/patients/${activePatient.id}/rest-report` : '/reports', label: 'İstirahat R.' },
                { href: activePatient ? `/patients/${activePatient.id}/status-report` : '/reports', label: 'Durum Bildirir' },
            ]
        },
        // Arşiv (Collapsible Group)
        {
            label: activePatient && counts && (counts.document > 0 || counts.photo > 0)
                ? `Arşiv [${(counts.document || 0) + (counts.photo || 0)}]`
                : 'Arşiv',
            icon: FolderArchive,
            href: '', // Group header
            children: [
                {
                    href: activePatient ? `/patients/${activePatient.id}/archive` : '/archive',
                    label: activePatient && counts && counts.document > 0 ? `Belgeler [${counts.document}]` : 'Belgeler'
                },
                {
                    href: activePatient ? `/patients/${activePatient.id}/photos` : '/photos',
                    label: activePatient && counts && counts.photo > 0 ? `Fotoğraflar [${counts.photo}]` : 'Fotoğraflar'
                },
            ]
        },
    ], [activePatient, counts]);

    const footerNav = [
        { href: '/reports', label: 'İstatistikler', icon: Calculator },
        { href: '/settings', label: 'Ayarlar', icon: Settings },
    ];

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isFinanceOpen, setIsFinanceOpen] = useState(false);
    const [isSecondaryOpen, setIsSecondaryOpen] = useState(false);
    const secondaryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-close secondary menu after 8 seconds of inactivity
    useEffect(() => {
        if (isSecondaryOpen) {
            secondaryTimeoutRef.current = setTimeout(() => {
                setIsSecondaryOpen(false);
            }, 8000);
        }
        return () => {
            if (secondaryTimeoutRef.current) {
                clearTimeout(secondaryTimeoutRef.current);
            }
        };
    }, [isSecondaryOpen]);

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    const NavItem = ({ item }: { item: any }) => {
        const [isOpen, setIsOpen] = useState(false);
        // Active check needs to be smarter for nested routes or exact match
        const isActive = item.href && (pathname === item.href || pathname?.startsWith(item.href + '/'));

        // Check if any child is active
        const isChildActive = item.children?.some((child: any) => pathname === child.href || pathname?.startsWith(child.href + '/'));

        // If children, use a button div logic to expand/collapse
        if (item.children) {
            return (
                <div className="space-y-0.5">
                    <button
                        onClick={() => {
                            if (isCollapsed) setIsCollapsed(false); // Auto-expand if clicking group in collapsed mode
                            setIsOpen(!isOpen);
                        }}
                        className={cn(
                            'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 group hover:bg-slate-100',
                            isChildActive || isOpen ? 'text-slate-900' : 'text-slate-500',
                            isCollapsed && "justify-center px-1"
                        )}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                            <item.icon className={cn(
                                "h-4 w-4 transition-colors",
                                isChildActive ? (item.activeColor || "text-blue-600") : "text-slate-400 group-hover:text-slate-600",
                                isCollapsed && "h-5 w-5"
                            )} />
                            {!isCollapsed && <span>{item.label}</span>}
                        </div>
                        {!isCollapsed && (isOpen || isChildActive ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />)}
                    </button>

                    {(isOpen || isChildActive) && !isCollapsed && (
                        <div className="pl-9 space-y-1">
                            {item.children.map((child: any) => (
                                <Link
                                    key={child.href}
                                    href={child.href}
                                    className={cn(
                                        'block px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
                                        pathname === child.href || pathname?.startsWith(child.href + '/')
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                    )}
                                >
                                    {child.label}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <Link
                href={item.href}
                className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 group',
                    isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                    isCollapsed && "justify-center px-1"
                )}
                title={isCollapsed ? item.label : undefined}
            >
                <item.icon className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? (item.activeColor || "text-blue-600") : "text-slate-400 group-hover:text-slate-600",
                    isCollapsed && "h-5 w-5"
                )} />
                {!isCollapsed && item.label}
            </Link>
        );
    };

    return (
        <aside className={cn(
            "bg-white border-r border-slate-100 flex flex-col h-screen shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)] z-20 shrink-0 transition-all duration-300 relative",
            isCollapsed ? "w-[70px]" : "w-[220px]"
        )}>
            {/* Toggle Button */}
            <button
                onClick={toggleCollapse}
                className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1.5 shadow-sm text-slate-400 hover:text-blue-600 z-50 hover:shadow-md transition-all"
            >
                <Menu className="h-3.5 w-3.5" />
            </button>

            {/* Logo Area */}
            <div className={cn("flex flex-col items-center pt-5 pb-2 min-h-[80px] justify-center transition-all", isCollapsed ? "px-2" : "px-6")}>
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt="Klinik Logo"
                        style={{ width: isCollapsed ? '40px' : `${logoWidth}px` }}
                        className={cn("object-contain transition-all", isCollapsed ? "max-h-10" : "max-h-24")}
                    />
                ) : (
                    <div className={cn("relative transition-all", isCollapsed ? "w-8 h-8" : "w-full h-24")}>
                        <Image
                            src="/logo.png"
                            alt="UroLog EMR Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                )}
            </div>

            {/* Navigation Sections */}
            <div className={cn("flex-1 overflow-y-auto py-2 space-y-6 scrollbar-hide", isCollapsed ? "px-2" : "px-4")}>

                {/* GENEL */}
                <div>
                    <nav className="space-y-1">
                        {mainNav.map((item) => <NavItem key={item.href} item={item} />)}
                    </nav>
                </div>

                {/* KLİNİK MODÜLLER */}
                <div>
                    {activePatient ? (
                        <div className={cn("mb-2 group relative transition-all", isCollapsed ? "pl-0 text-center" : "pl-3")}>
                            {!isCollapsed ? (
                                <div className="flex items-center justify-between pr-2 pt-1">
                                    <Link href={`/patients/${activePatient.id}`} className="block">
                                        <p className="font-bold text-emerald-600 text-xs hover:text-blue-600 hover:text-base transition-all duration-200 truncate max-w-[180px]" title={`${activePatient.ad} ${activePatient.soyad}`}>
                                            {activePatient.ad} {activePatient.soyad}
                                        </p>
                                    </Link>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setActivePatient(null);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                                    >
                                        <LogOut className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => setActivePatient(null)}
                                        title={`${activePatient.ad} ${activePatient.soyad} (Çıkış)`}
                                        className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs"
                                    >
                                        {activePatient.ad[0]}{activePatient.soyad[0]}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div
                            className={cn("mb-2 transition-all cursor-pointer hover:bg-slate-100 rounded-lg", isCollapsed ? "px-0 text-center py-2" : "pl-3 py-2")}
                            onClick={() => router.push('/dashboard')}
                            title="Hasta seçmek için Dashboard'a gidin"
                        >
                            {!isCollapsed && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Klinik İşlemler</p>}
                            {!isCollapsed && <p className="text-[9px] text-slate-400 mt-0.5">Hasta seçiniz...</p>}
                            {isCollapsed && <Stethoscope className="h-5 w-5 text-slate-300 mx-auto" />}
                        </div>
                    )}

                    {activePatient && (
                        <div className={cn(
                            "rounded-xl transition-colors",
                            isCollapsed ? "p-1" : "p-2 border",
                            isCollapsed ? "bg-transparent" : "bg-blue-50/50 border-blue-100"
                        )}>
                            <nav className="space-y-1">
                                {primaryClinicalNav.map((item) => <NavItem key={item.label} item={item} />)}

                                {/* Diğer İşlemler Accordion */}
                                <button
                                    onClick={() => {
                                        if (isCollapsed) setIsCollapsed(false);
                                        setIsSecondaryOpen(!isSecondaryOpen);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 group hover:bg-slate-100 mt-2",
                                        isSecondaryOpen ? "text-slate-900 bg-slate-50" : "text-slate-500",
                                        isCollapsed && "justify-center px-1"
                                    )}
                                    title={isCollapsed ? "Diğer İşlemler" : undefined}
                                >
                                    <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                                        <Settings className={cn(
                                            "h-4 w-4 transition-colors",
                                            isSecondaryOpen ? "text-slate-600" : "text-slate-400 group-hover:text-slate-600",
                                            isCollapsed && "h-5 w-5"
                                        )} />
                                        {!isCollapsed && <span className="text-xs">Diğer İşlemler</span>}
                                    </div>
                                    {!isCollapsed && (isSecondaryOpen ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />)}
                                </button>

                                {isSecondaryOpen && !isCollapsed && (
                                    <div className="pl-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                        {secondaryClinicalNav.map((item) => <NavItem key={item.label} item={item} />)}
                                    </div>
                                )}
                            </nav>
                        </div>
                    )}
                </div>
                {/* FİNANSAL İŞLEMLER */}
                {/* FİNANSAL İŞLEMLER - Collapsible */}
                <div>
                    <button
                        onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                        className={cn(
                            "w-full flex items-center justify-between p-2 text-sm font-medium rounded-lg transition-all duration-200 group hover:bg-slate-100 mb-1",
                            isFinanceOpen ? "text-slate-900" : "text-slate-500",
                            isCollapsed && "justify-center px-1"
                        )}
                        title="Finansal İşlemler"
                    >
                        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                            <Wallet className={cn(
                                "h-4 w-4 transition-colors",
                                isFinanceOpen ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600",
                                isCollapsed && "h-5 w-5"
                            )} />
                            {!isCollapsed && <span>Finansal İşlemler</span>}
                        </div>
                        {!isCollapsed && (isFinanceOpen ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />)}
                    </button>

                    {isFinanceOpen && (
                        <div className={cn(
                            "rounded-xl p-2 border bg-emerald-50/10 border-emerald-100/30 transition-all animate-in slide-in-from-top-2 duration-200",
                            isCollapsed && "bg-transparent p-0 border-0"
                        )}>
                            <nav className="space-y-1">
                                <NavItem item={{ href: '/finance', label: 'Finans Paneli', icon: LayoutDashboard }} />
                                <NavItem item={{ href: '/finance/income', label: 'Gelirler', icon: TrendingUp }} />
                                <NavItem item={{ href: '/finance/expenses', label: 'Giderler', icon: TrendingDown }} />
                                <NavItem item={{ href: '/finance/debtors', label: 'Borçlu Listesi', icon: Users }} />
                                <NavItem item={{ href: '/finance/reports', label: 'Finans Raporları', icon: Calculator }} />
                                <NavItem item={{ href: '/finance/settings', label: 'Finans Ayarları', icon: Settings }} />
                            </nav>
                        </div>
                    )}
                </div>

                {/* STOK YÖNETİMİ */}
                <div className={isCollapsed ? "px-1" : "px-0"}>
                    <nav className="space-y-1">
                        <NavItem item={{ href: '/stock', label: 'Stok Yönetimi', icon: Package }} />
                    </nav>
                </div>
            </div>

            {/* Footer Area */}
            <div className={cn("bg-slate-50 border-t border-slate-100 space-y-2 transition-all", isCollapsed ? "p-2" : "p-4")}>
                <nav className="space-y-1">
                    {footerNav.map((item) => <NavItem key={item.href} item={item} />)}
                </nav>

                {!isCollapsed && (
                    <div className="pt-2 text-center transition-opacity flex flex-col items-center gap-1">
                        <p className="text-[9px] text-slate-600 font-mono font-medium">
                            v{process.env.NEXT_PUBLIC_GIT_SHA === 'production' ? 'github version' : (process.env.NEXT_PUBLIC_GIT_SHA || 'dev')}
                        </p>
                        <div className="pt-1 border-t border-slate-200/60 w-full">
                            <p className="text-[9px] font-semibold text-slate-600">
                                &copy; {new Date().getFullYear()} Dr. Alp Özkan
                            </p>
                            <p className="text-[8px] text-slate-500 uppercase tracking-tighter">
                                Tüm Hakları Saklıdır | UroLog
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
