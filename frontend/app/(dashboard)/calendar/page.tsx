'use client';

import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, addDays, subDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../../calendar.css';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from "@/components/ui/slider";
import { Plus, RefreshCw, Check, X, PhoneOff, Calendar as CalendarIcon, ChevronLeft, ChevronRight, MoreHorizontal, Edit, Edit2, Pencil, Stethoscope, Filter, Settings2, ZoomIn, ZoomOut, User, MapPin, Mail, Link as LinkIcon, Info, Phone } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, Appointment } from '@/lib/api';
import { CreateAppointmentDialog } from '@/components/appointments/create-appointment-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from '@/components/ui/popover';
import { Calendar as MiniCalendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Trash2, ExternalLink, Banknote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

const DnDCalendar = withDragAndDrop(Calendar);

const locales = {
    'tr': tr,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

// Custom Toolbar to Hide Default
const CustomToolbar = () => null;

const messages = {
    allDay: 'Tüm Gün',
    previous: 'Geri',
    next: 'İleri',
    today: 'Bugün',
    month: 'Ay',
    week: 'Hafta',
    day: 'Gün',
    agenda: 'Ajanda',
    date: 'Tarih',
    time: 'Zaman',
    event: 'Etkinlik',
    noEventsInRange: 'Bu aralıkta etkinlik yok.',
};

interface CalendarEvent {
    id: number;
    title: string;
    start: Date;
    end: Date;
    resource: Appointment;
}

export default function CalendarPage() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const { user: currentUser } = useAuthStore();

    // Role-based default view: Doctor -> Day, Secretary -> Week
    const getDefaultView = (): View => {
        if (currentUser?.role === 'doctor') return Views.DAY;
        return Views.WEEK;
    };

    const [view, setView] = useState<View>(getDefaultView);
    const [date, setDate] = useState(new Date());
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>(undefined);
    const [selectedSlotStart, setSelectedSlotStart] = useState<Date | undefined>(undefined);
    const [selectedSlotEnd, setSelectedSlotEnd] = useState<Date | undefined>(undefined);
    const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
    const [zoom, setZoom] = useState(150); // Increased default height from 100 to 150 for better visibility of 30min slots

    // Sidebar visibility with localStorage persistence
    const [showSidebar, setShowSidebar] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('calendar_sidebar_visible');
            return saved !== 'false'; // Default to true
        }
        return true;
    });

    const toggleSidebar = useCallback(() => {
        setShowSidebar(prev => {
            const newValue = !prev;
            localStorage.setItem('calendar_sidebar_visible', String(newValue));
            return newValue;
        });
    }, []);

    // Fetch Settings for Colors
    const { data: settings = [] } = useQuery({
        queryKey: ['settings'],
        queryFn: api.settings.getAll,
    });

    // Set default view based on user role after settings load
    useEffect(() => {
        if (currentUser) {
            if (currentUser.role === 'doctor' || currentUser.role === 'admin') {
                setView(Views.DAY);
            } else {
                setView(Views.WEEK);
            }
        }
    }, [currentUser]);

    // Parse working hours from settings to get active days AND time ranges
    const workingHoursConfig = useMemo(() => {
        const whSetting = settings.find((s: any) => s.key === 'working_hours');
        const dayMap: Record<string, number> = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6
        };

        // Default config
        const defaultConfig = {
            activeDays: [1, 2, 3, 4, 5, 6],
            daySchedule: {} as Record<number, { start: string; end: string }>
        };

        // Set default hours for each day
        [1, 2, 3, 4, 5, 6].forEach(d => {
            defaultConfig.daySchedule[d] = { start: '09:00', end: '18:00' };
        });

        if (!whSetting || !whSetting.value) {
            return defaultConfig;
        }

        try {
            const wh = JSON.parse(whSetting.value);
            const activeDays: number[] = [];
            const daySchedule: Record<number, { start: string; end: string }> = {};

            Object.entries(dayMap).forEach(([dayKey, dayIndex]) => {
                if (wh[dayKey]?.isOpen) {
                    activeDays.push(dayIndex);
                    daySchedule[dayIndex] = {
                        start: wh[dayKey].start || '09:00',
                        end: wh[dayKey].end || '18:00'
                    };
                }
            });

            return {
                activeDays: activeDays.length > 0 ? activeDays : defaultConfig.activeDays,
                daySchedule: Object.keys(daySchedule).length > 0 ? daySchedule : defaultConfig.daySchedule
            };
        } catch {
            return defaultConfig;
        }
    }, [settings]);

    // Convenience accessor for backward compatibility
    const workingDays = workingHoursConfig.activeDays;

    // Fetch Users (Doctors)
    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: api.auth.getUsers,
    });

    const doctors = useMemo(() => {
        return users.filter((u: any) => u.role === 'doctor' || u.role === 'admin');
    }, [users]);

    const typeColors = useMemo(() => {
        const colors: Record<string, string> = {};
        const defsSetting = settings.find((s: any) => s.key === 'system_definitions');
        if (defsSetting && typeof defsSetting.value === 'string') {
            try {
                const defs = JSON.parse(defsSetting.value);
                const types = defs['Randevu Türleri'] || [];
                if (Array.isArray(types)) {
                    types.forEach((t: any) => {
                        if (typeof t !== 'string') return;
                        const parts = t.split('|');
                        const name = parts[0]?.trim();
                        const color = parts[2]?.trim();
                        if (name && color) colors[name] = color;
                    });
                }
            } catch (e) {
                console.error("Error parsing settings for colors", e);
            }
        }
        return colors;
    }, [settings]);

    // Calculate date range for query based on current view
    const dateRange = useMemo(() => {
        const start = startOfMonth(addMonths(date, -1));
        const end = endOfMonth(addMonths(date, 1));
        return {
            start: start.toISOString(),
            end: end.toISOString()
        };
    }, [date]);

    // Fetch appointments
    const { data: appointments, isLoading, refetch } = useQuery({
        queryKey: ['appointments', dateRange.start, dateRange.end],
        queryFn: () => api.appointments.list({ start: dateRange.start, end: dateRange.end }),
    });

    // Delete Mutation
    const deleteAppointmentMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) => api.appointments.delete(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            toast.success('Randevu silindi');
        },
        onError: () => {
            toast.error('Silme işlemi başarısız');
        }
    });

    // Update Mutation
    const updateAppointmentMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => api.appointments.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            toast.success('Randevu güncellendi');
        },
        onError: () => {
            toast.error('Güncelleme başarısız');
        }
    });

    // Transform and Filter API data to calendar events
    const events: CalendarEvent[] = useMemo(() => {
        if (!appointments) return [];

        let filtered = appointments;
        if (selectedDoctorIds.length > 0) {
            filtered = appointments.filter((apt: Appointment) => {
                const docId = apt.doctor_id || apt.doctor?.id;
                return docId && selectedDoctorIds.includes(String(docId));
            });
        }

        return filtered.map((apt: Appointment) => ({
            id: apt.id,
            title: apt.hasta
                ? `${apt.hasta.ad} ${apt.hasta.soyad}`
                : apt.title,
            start: parseISO(apt.start),
            end: parseISO(apt.end),
            resource: apt,
        }));
    }, [appointments, selectedDoctorIds]);

    // Handlers
    const handleDoctorToggle = (id: string) => {
        setSelectedDoctorIds(prev =>
            prev.includes(id)
                ? prev.filter(p => p !== id)
                : [...prev, id]
        );
    };

    const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
        if (action === 'TODAY') {
            setDate(new Date());
            return;
        }

        const amount = action === 'NEXT' ? 1 : -1;
        switch (view) {
            case Views.MONTH:
                setDate(prev => addMonths(prev, amount));
                break;
            case Views.WEEK:
                setDate(prev => addWeeks(prev, amount));
                break;
            case Views.DAY:
                setDate(prev => addDays(prev, amount));
                break;
            default:
                setDate(new Date());
        }
    };

    const handleViewChange = (newView: View) => {
        setView(newView);
    };

    // Helper function to check if a time is within working hours for a given day
    const isWithinWorkingHours = useCallback((dateTime: Date): boolean => {
        const dayOfWeek = dateTime.getDay();

        // Check if day is active
        if (!workingHoursConfig.activeDays.includes(dayOfWeek)) {
            return false;
        }

        // Get schedule for this day
        const schedule = workingHoursConfig.daySchedule[dayOfWeek];
        if (!schedule) return false;

        const hours = dateTime.getHours();
        const minutes = dateTime.getMinutes();
        const currentMinutes = hours * 60 + minutes;

        const [startH, startM] = schedule.start.split(':').map(Number);
        const [endH, endM] = schedule.end.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }, [workingHoursConfig]);

    // Slot prop getter for styling non-working hours
    const slotPropGetter = useCallback((date: Date) => {
        const dayOfWeek = date.getDay();

        // Closed day
        if (!workingHoursConfig.activeDays.includes(dayOfWeek)) {
            return {
                className: 'rbc-off-hours',
                style: { backgroundColor: '#f1f5f9' }
            };
        }

        // Check time
        const schedule = workingHoursConfig.daySchedule[dayOfWeek];
        if (!schedule) {
            return {};
        }

        const hours = date.getHours();
        const minutes = date.getMinutes();
        const currentMinutes = hours * 60 + minutes;

        const [startH, startM] = schedule.start.split(':').map(Number);
        const [endH, endM] = schedule.end.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
            return {
                className: 'rbc-off-hours',
                style: { backgroundColor: '#f1f5f9' }
            };
        }

        return {};
    }, [workingHoursConfig]);

    // Day prop getter for styling closed days
    const dayPropGetter = useCallback((date: Date) => {
        const dayOfWeek = date.getDay();

        if (!workingHoursConfig.activeDays.includes(dayOfWeek)) {
            return {
                className: 'rbc-closed-day',
                style: { backgroundColor: '#f8fafc', opacity: 0.5 }
            };
        }

        return {};
    }, [workingHoursConfig]);

    // Handlers for DnD
    const onEventResize = useCallback(
        ({ event, start, end }: any) => {
            const calEvent = event as CalendarEvent;
            updateAppointmentMutation.mutate({
                id: calEvent.id,
                data: { start: start.toISOString(), end: end.toISOString() }
            });
        },
        [updateAppointmentMutation]
    );

    const onEventDrop = useCallback(
        ({ event, start, end }: any) => {
            const calEvent = event as CalendarEvent;
            updateAppointmentMutation.mutate({
                id: calEvent.id,
                data: { start: start.toISOString(), end: end.toISOString() }
            });
        },
        [updateAppointmentMutation]
    );

    // --- Examination Summary Dialog ---
    interface SummaryDialogProps {
        isOpen: boolean;
        onClose: () => void;
        patientId?: string;
        patientName?: string;
    }

    function ExaminationSummaryDialog({ isOpen, onClose, patientId, patientName }: SummaryDialogProps) {
        const { data: muayeneler, isLoading } = useQuery({
            queryKey: ['clinical', 'muayeneler', patientId],
            queryFn: () => patientId ? api.clinical.getMuayeneler(patientId) : Promise.resolve([]),
            enabled: !!patientId && isOpen,
        });

        const latestExam = useMemo(() => {
            if (!muayeneler || muayeneler.length === 0) return null;
            return [...muayeneler].sort((a, b) => {
                const dateA = a.tarih ? new Date(a.tarih).getTime() : 0;
                const dateB = b.tarih ? new Date(b.tarih).getTime() : 0;
                return dateB - dateA;
            })[0];
        }, [muayeneler]);

        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            {patientName} - Muayene Özeti
                        </DialogTitle>
                    </DialogHeader>

                    {isLoading ? (
                        <div className="py-10 text-center text-slate-500">Yükleniyor...</div>
                    ) : !latestExam ? (
                        <div className="py-10 text-center text-slate-500 italic">Henüz muayene kaydı bulunmuyor.</div>
                    ) : (
                        <ScrollArea className="max-h-[60vh] pr-4">
                            <div className="space-y-4 py-2">
                                {latestExam.tarih && (
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Son Muayene Tarihi: {format(parseISO(latestExam.tarih), 'dd.MM.yyyy')}
                                    </div>
                                )}

                                {latestExam.sikayet && (
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-slate-900">Şikayet</h4>
                                        <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                                            "{latestExam.sikayet}"
                                        </p>
                                    </div>
                                )}

                                {(latestExam.tani || latestExam.tani1 || latestExam.tani2) && (
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-slate-900">Tanılar</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[latestExam.tani, latestExam.tani1, latestExam.tani2].filter(Boolean).map((t, idx) => (
                                                <Badge key={idx} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100 py-1">
                                                    {t}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {latestExam.sonuc && (
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-slate-900">Sonuç / Karar</h4>
                                        <p className="text-sm text-slate-600 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                                            {latestExam.sonuc}
                                        </p>
                                    </div>
                                )}

                                {latestExam.tedavi && (
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-slate-900">Tedavi / Plan</h4>
                                        <p className="text-sm text-slate-600 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                                            {latestExam.tedavi}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                    <DialogFooter className="flex sm:justify-between gap-2">
                        {patientId && (
                            <Button
                                variant="default"
                                className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none"
                                onClick={() => {
                                    router.push(`/patients/${patientId}/examination`);
                                    onClose();
                                }}
                            >
                                <Stethoscope className="w-4 h-4 mr-2" />
                                Muayene Detay
                            </Button>
                        )}
                        <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Kapat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    const [summaryDialog, setSummaryDialog] = useState<{ open: boolean; patientId?: string; patientName?: string }>({ open: false });

    // --- Cancellation Reason Dialog ---
    const [cancelDialog, setCancelDialog] = useState<{ open: boolean; id?: number }>({ open: false });
    const cancelReasons = ['Zaman', 'Hastalık', 'Fiyat', 'Farklı Hekim', 'Randevu Süresi'];

    // --- Deletion Reason Dialog ---
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: number }>({ open: false });
    const [deleteReason, setDeleteReason] = useState('');

    // Custom Event Component
    const CustomEvent = ({ event }: { event: CalendarEvent }) => {
        const apt = event.resource;
        const [isOpen, setIsOpen] = useState(false);
        const [isEditing, setIsEditing] = useState(false);
        const [editDate, setEditDate] = useState<Date>(event.start);
        const [editStartTime, setEditStartTime] = useState(format(event.start, 'HH:mm'));
        const [editEndTime, setEditEndTime] = useState(format(event.end, 'HH:mm'));

        // Virtual Anchor for popup position
        const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
        const [calendarOpen, setCalendarOpen] = useState(false);

        const handleSaveEdit = () => {
            const [startH, startM] = editStartTime.split(':').map(Number);
            const [endH, endM] = editEndTime.split(':').map(Number);

            const newStart = new Date(editDate);
            newStart.setHours(startH, startM);

            const newEnd = new Date(editDate);
            newEnd.setHours(endH, endM);

            updateAppointmentMutation.mutate({
                id: apt.id,
                data: {
                    start: newStart.toISOString(),
                    end: newEnd.toISOString()
                }
            });
            setIsEditing(false);
        };

        const handleStatusChange = (status: string) => {
            if (status === 'cancelled') {
                setCancelDialog({ open: true, id: apt.id });
                setIsOpen(false);
            } else {
                updateAppointmentMutation.mutate({ id: apt.id, data: { status } });
                setIsOpen(false);
            }
        };

        const handleEdit = () => {
            // Close the popover and open the full edit dialog
            setIsOpen(false);
            setEditingAppointment(apt);
            setShowCreateDialog(true);
        };

        const handleDelete = () => {
            setDeleteDialog({ open: true, id: apt.id });
            setDeleteReason('');
            setIsOpen(false);
        };

        const handleSummary = () => {
            setIsOpen(false);
            if (apt.hasta_id) {
                setSummaryDialog({
                    open: true,
                    patientId: String(apt.hasta_id),
                    patientName: apt.hasta ? `${apt.hasta.ad} ${apt.hasta.soyad}` : apt.title
                });
            } else {
                toast.error('Bu randevu bir hastaya bağlı değil.');
            }
        };

        const handleGoToPatient = () => {
            setIsOpen(false);
            if (apt.hasta_id) {
                router.push(`/patients/${apt.hasta_id}`);
            } else {
                toast.error('Bu randevu bir hastaya bağlı değil.');
            }
        };

        const handleGoogleSync = async () => {
            try {
                const res = await api.integrations.syncToGoogle(apt.id);
                toast.success(res.message);
                queryClient.invalidateQueries({ queryKey: ['appointments'] });
            } catch (error: any) {
                toast.error("Senkronizasyon hatası: " + error.message);
            }
        };

        const handleEventClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            setClickPosition({ x: e.clientX, y: e.clientY });
            setIsOpen(true);
        };

        // Status Based Styling
        const statusStyles: Record<string, string> = {
            'scheduled': 'bg-blue-100 border-blue-600 text-blue-900 hover:bg-blue-200',
            'confirmed': 'bg-emerald-100 border-emerald-600 text-emerald-900 hover:bg-emerald-200',
            'unreachable': 'bg-orange-100 border-orange-600 text-orange-900 hover:bg-orange-200',
            'cancelled': 'bg-red-100 border-red-600 text-red-900 decoration-line-through opacity-70 hover:bg-red-200',
            'completed': 'bg-slate-100 border-slate-600 text-slate-900 hover:bg-slate-200',
            'blocked': 'bg-red-50 border-red-800 text-red-900 hover:bg-red-100 font-black',
        };

        const currentStyle = statusStyles[apt.status] || statusStyles['scheduled'];

        const statusLabel = {
            'scheduled': 'Beklemede',
            'confirmed': 'Onaylandı',
            'unreachable': 'Ulaşılamadı',
            'cancelled': 'İptal',
            'completed': 'Tamamlandı',
            'blocked': 'BLOKE / KAPALI'
        }[apt.status] || 'Beklemede';

        const statusDotColor = {
            'scheduled': 'bg-red-500',
            'confirmed': 'bg-emerald-500',
            'unreachable': 'bg-orange-500',
            'cancelled': 'bg-slate-400',
            'completed': 'bg-blue-500',
            'blocked': 'bg-red-800'
        }[apt.status] || 'bg-red-500';

        // Content Rendering Logic based on View
        const renderContent = () => {
            const timeRange = `${format(event.start, 'HH:mm')}-${format(event.end, 'HH:mm')}`;
            const doctorName = apt.doctor?.full_name || apt.doctor?.username;

            if (view === Views.DAY) {
                // Day: Time Range + Name (Side-by-Side)
                return (
                    <div className="flex gap-2 h-full pl-1.5 py-0.5">
                        <span className="text-[11px] font-mono leading-none font-bold opacity-90 whitespace-nowrap pt-0.5">
                            {timeRange}
                        </span>
                        <div className="h-full w-px bg-current opacity-30" />
                        <div className="flex flex-col overflow-hidden justify-center max-w-full">
                            <span className="font-bold text-sm truncate leading-tight">
                                {event.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                {apt.type && (
                                    <span className="text-[10px] opacity-80 leading-tight font-normal bg-white/20 px-1 rounded">
                                        {apt.type}
                                    </span>
                                )}
                                {doctorName && (
                                    <span className="text-[10px] opacity-90 truncate leading-tight font-bold italic border-l border-current/30 pl-1.5">
                                        {doctorName}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            } else if (view === Views.WEEK) {
                // Week: Time Range, Name, Type, Doctor (Stacked)
                return (
                    <div className="flex flex-col justify-center h-full pl-1 overflow-hidden space-y-0.5">
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-bold opacity-80 whitespace-nowrap">
                                {timeRange}
                            </span>
                            <span className="font-bold text-[12px] leading-tight">
                                {event.title}
                            </span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                            {apt.type && (
                                <span className="text-[10px] opacity-80 leading-tight font-normal">
                                    {apt.type}
                                </span>
                            )}
                            {doctorName && (
                                <span className="text-[9px] opacity-90 truncate leading-tight font-bold italic">
                                    {doctorName}
                                </span>
                            )}
                        </div>
                    </div>
                );
            } else {
                // Month View: [Colored Bar] [Name] ( [Type/Doctor] ) [Time]
                const statusTextColor = {
                    'scheduled': 'text-slate-900', // Default stay dark
                    'confirmed': 'text-slate-900',
                    'unreachable': 'text-orange-700',
                    'cancelled': 'text-red-400 line-through opacity-70',
                    'completed': 'text-blue-700',
                    'blocked': 'text-red-900 font-black',
                }[apt.status] || 'text-slate-900';

                const details = [apt.type, doctorName].filter(Boolean).join(' - ');

                return (
                    <div className="flex items-center h-5 w-full bg-transparent hover:bg-slate-50/80 transition-colors group/event">
                        {/* Status Bar */}
                        <div className={cn("w-[2.5px] h-[14px] shrink-0 rounded-full ml-0.5", statusDotColor)} />

                        <div className={cn("flex-1 flex items-center justify-between px-1.5 min-w-0 gap-1", statusTextColor)}>
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                                <span className="font-semibold text-[10.5px] truncate leading-none">
                                    {event.title}
                                </span>
                                {details && (
                                    <span className="text-[9px] opacity-50 truncate leading-none font-medium">
                                        ({details})
                                    </span>
                                )}
                            </div>
                            <span className="text-[9.5px] font-bold opacity-70 shrink-0 tabular-nums">
                                {format(event.start, 'HH:mm')}
                            </span>
                        </div>
                    </div>
                );
            }
        };

        const baseClasses = "w-full h-full cursor-pointer relative group flex flex-col transition-all overflow-hidden";
        // Specific styling logic overrides
        const viewClasses = view === Views.MONTH
            ? "justify-center p-0.5"
            : "border-l-[4px] py-1 pr-1"; // Add border for Day/Week

        return (
            <Popover open={isOpen} onOpenChange={(o) => {
                setIsOpen(o);
                if (!o) setIsEditing(false);
            }}>
                <PopoverAnchor
                    virtualRef={{
                        current: {
                            getBoundingClientRect: () => ({
                                width: 0,
                                height: 0,
                                top: clickPosition?.y || 0,
                                left: clickPosition?.x || 0,
                                right: clickPosition?.x || 0,
                                bottom: clickPosition?.y || 0,
                                x: clickPosition?.x || 0,
                                y: clickPosition?.y || 0,
                                toJSON: () => { }
                            })
                        }
                    }}
                />
                <div onClick={handleEventClick} className={cn(baseClasses, currentStyle, viewClasses)}>
                    {renderContent()}
                </div>
                <PopoverContent className="w-[320px] p-3 bg-white shadow-xl border border-slate-200 rounded-2xl overflow-hidden" sideOffset={5}>
                    <div className="space-y-3">
                        {/* Header Section */}
                        <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                                <h3 className="text-sm font-bold text-slate-900 leading-tight uppercase truncate max-w-[200px]">
                                    {event.title}
                                </h3>
                                {apt.type && <span className="text-xs text-slate-500 font-medium">({apt.type})</span>}
                            </div>
                        </div>

                        {/* Phone Section - Slightly Compact */}
                        {apt.status !== 'blocked' && (
                            <div className="flex items-center justify-between py-1 border-t border-slate-50">
                                <div className="flex items-center gap-2">
                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-600">{apt.hasta?.cep_tel || '-'}</span>
                                </div>
                                <Button variant="secondary" size="sm" className="h-6 px-3 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] font-bold">
                                    Ara
                                </Button>
                            </div>
                        )}

                        {/* Date/Time Section with Inline Edit */}
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 relative group/time transition-all">
                            {!isEditing ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                        <span>{format(event.start, 'd MMM yyyy', { locale: tr })}</span>
                                        <span className="text-slate-300">|</span>
                                        <span>{format(event.start, 'HH:mm')} – {format(event.end, 'HH:mm')}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleEdit}
                                        className="h-6 px-2 text-[10px] font-bold text-amber-600 hover:bg-amber-100 hover:text-amber-700 bg-amber-50/50 opacity-0 group-hover/time:opacity-100 transition-all absolute right-2"
                                    >
                                        <Pencil className="w-3 h-3 mr-1" />
                                        Düzenle
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Tarih ve Saat Düzenle</span>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsEditing(false)}
                                                className="h-5 w-5 p-0 text-slate-400 hover:text-slate-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handleSaveEdit}
                                                className="h-5 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                                            >
                                                <Check className="w-3 h-3 mr-1" />
                                                Kaydet
                                            </Button>
                                        </div>
                                    </div>


                                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen} modal>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full h-8 justify-start text-left font-normal text-xs bg-white border-slate-200",
                                                    !editDate && "text-muted-foreground"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCalendarOpen(true);
                                                }}
                                            >
                                                <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-50" />
                                                {editDate ? format(editDate, "d MMMM yyyy", { locale: tr }) : <span>Tarih seçin</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="w-auto p-0 z-[9999]"
                                            onInteractOutside={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }}
                                            onPointerDownOutside={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }}
                                        >
                                            <MiniCalendar
                                                mode="single"
                                                selected={editDate}
                                                onSelect={(d) => {
                                                    if (d) {
                                                        setEditDate(d);
                                                        setCalendarOpen(false);
                                                    }
                                                }}
                                                initialFocus
                                                locale={tr}
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Baş</span>
                                            <input
                                                type="time"
                                                className="w-full h-8 pl-8 pr-1 text-xs font-bold border rounded-md border-slate-200 focus:ring-1 focus:ring-blue-500 bg-white"
                                                value={editStartTime}
                                                onChange={(e) => setEditStartTime(e.target.value)}
                                            />
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Bit</span>
                                            <input
                                                type="time"
                                                className="w-full h-8 pl-8 pr-1 text-xs font-bold border rounded-md border-slate-200 focus:ring-1 focus:ring-blue-500 bg-white"
                                                value={editEndTime}
                                                onChange={(e) => setEditEndTime(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Details Box Section - Compact */}
                        <div className="p-3 bg-slate-50/80 rounded-[14px] border border-slate-100 space-y-1.5">
                            <div className="grid grid-cols-[80px_1fr] gap-x-2 text-[11px] leading-relaxed">
                                <span className="text-slate-400 font-medium">Durum:</span>
                                <span className="text-slate-700 font-bold">{statusLabel}</span>

                                <span className="text-slate-400 font-medium">Hekim:</span>
                                <span className="text-slate-700 font-bold truncate">{apt.doctor?.full_name || '-'}</span>
                            </div>
                        </div>

                        {/* Footer Section (Notes) */}
                        {apt.notes && (
                            <div className="flex flex-col gap-0.5 p-2 bg-blue-50/30 rounded-lg border border-blue-100/50">
                                <span className="text-[10px] font-bold text-blue-600 uppercase">Not</span>
                                <p className="text-[11px] text-slate-600 line-clamp-2 italic leading-snug">
                                    {apt.notes}
                                </p>
                            </div>
                        )}

                        {/* Actions Overlay / Bottom Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                            {apt.status !== 'blocked' && (
                                <>
                                    <Button
                                        onClick={handleGoToPatient}
                                        variant="secondary"
                                        className="h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs"
                                    >
                                        <User className="w-3.5 h-3.5 mr-2" />
                                        Detay
                                    </Button>
                                    <Button
                                        onClick={handleSummary}
                                        variant="outline"
                                        className="h-9 rounded-xl border-slate-200 text-slate-700 font-bold text-xs"
                                    >
                                        <FileText className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                                        Muayene Özet
                                    </Button>
                                    <Button
                                        onClick={() => handleStatusChange('confirmed')}
                                        className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                    >
                                        <Check className="w-3.5 h-3.5 mr-2" />
                                        Onay
                                    </Button>
                                    <Button
                                        onClick={() => handleStatusChange('unreachable')}
                                        variant="outline"
                                        className="h-9 rounded-xl border-orange-200 bg-orange-50/50 text-orange-700 hover:bg-orange-100 font-bold text-xs"
                                    >
                                        <PhoneOff className="w-3.5 h-3.5 mr-2" />
                                        Ulaşılamadı
                                    </Button>
                                    <Button
                                        onClick={() => handleStatusChange('cancelled')}
                                        variant="outline"
                                        className="h-9 rounded-xl border-red-100 bg-red-50/30 text-red-600 hover:bg-red-50 font-bold text-xs"
                                    >
                                        <X className="w-3.5 h-3.5 mr-2" />
                                        İptal
                                    </Button>
                                </>
                            )}
                            <Button
                                onClick={handleDelete}
                                variant="outline"
                                className={cn(
                                    "h-9 rounded-xl border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-bold text-xs transition-colors",
                                    apt.status === 'blocked' && "col-span-2"
                                )}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                {apt.status === 'blocked' ? 'Blokeyi Kaldır (Sil)' : 'Randevu Sil'}
                            </Button>
                            {apt.status !== 'blocked' && apt.hasta_id && (
                                <>
                                    <Button
                                        onClick={() => {
                                            setIsOpen(false);
                                            router.push(`/patients/${apt.hasta_id}/finance`);
                                        }}
                                        className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                                    >
                                        <Banknote className="w-3.5 h-3.5 mr-2" />
                                        Tahsilat
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            window.open(api.integrations.getIcsDownloadUrl(apt.id), '_blank');
                                            setIsOpen(false);
                                        }}
                                        variant="outline"
                                        className="h-9 rounded-xl border-slate-200 text-slate-700 font-bold text-xs"
                                    >
                                        <CalendarIcon className="w-3.5 h-3.5 mr-2 text-blue-500" />
                                        iCal İndir
                                    </Button>
                                    <Button
                                        onClick={handleGoogleSync}
                                        variant="outline"
                                        className="h-9 rounded-xl border-blue-200 bg-blue-50/30 text-blue-700 hover:bg-blue-50 font-bold text-xs"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 mr-2 text-blue-600" />
                                        Google Sync
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        );
    };

    // Calendar Styles
    const calendarStyles = `
        .rbc-toolbar { display: none !important; }
        .rbc-header { padding: 8px; font-weight: 700; font-size: 0.75rem; color: #64748b; border-bottom: 1px solid #f1f5f9; text-transform: uppercase; letter-spacing: 0.05em; background: #fdfdfd; }
        .rbc-month-view { border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden; }
        .rbc-month-row { border-top: 1px solid #f1f5f9; }
        .rbc-day-bg { border-left: 1px solid #f1f5f9; }
        .rbc-today { background-color: #f8fafc; }
        .rbc-off-range-bg { background-color: #fcfcfc; opacity: 0.4; }
        
        /* Event Styling */
        .rbc-event { background: transparent; padding: 0; border: none !important; outline: none !important; box-shadow: none !important; overflow: visible !important; margin-bottom: 1px; }
        .rbc-event-label { display: none; } 
        .rbc-event.rbc-selected { background-color: transparent !important; }
        .rbc-event:focus { outline: none !important; }

        .rbc-time-view { border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden; }
        .rbc-time-slot { font-size: 0.75rem; font-weight: 500; color: #94a3b8; }
        .rbc-label { font-size: 0.75rem; color: #94a3b8; font-weight: 600; padding: 0 4px; }
        
        /* Month Date Numbers */
        .rbc-date-cell { padding: 4px 8px; font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-align: right; }
        .rbc-date-cell.rbc-now { color: #ef4444; }
        .rbc-date-cell.rbc-now a { background: #fee2e2; padding: 2px 6px; border-radius: 6px; }

        /* More link */
        .rbc-show-more { background: transparent; color: #94a3b8; font-size: 10px; font-weight: 700; padding-left: 8px; margin-top: 2px; }
        .rbc-show-more:hover { text-decoration: underline; color: #64748b; }

        .rbc-current-time-indicator { background-color: #ef4444 !important; height: 2px; }
        .rbc-current-time-indicator::before { content: ""; display: block; width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; position: absolute; left: -4px; top: -3px; }
        
        /* Dynamic Height Control */
        .rbc-timeslot-group { min-height: ${zoom}px !important; }
        .rbc-time-content { border-top: none; }

        /* Non-Working Hours & Closed Days */
        .rbc-off-hours { 
            background-color: #f1f5f9 !important; 
            background-image: repeating-linear-gradient(
                135deg,
                transparent,
                transparent 4px,
                rgba(148, 163, 184, 0.1) 4px,
                rgba(148, 163, 184, 0.1) 8px
            );
        }
        .rbc-closed-day { 
            background-color: #f8fafc !important; 
            opacity: 0.5;
        }
        .rbc-day-bg.rbc-closed-day {
            cursor: not-allowed;
        }
    `;

    // Filter appointments for the sidebar (Selected Date)
    const dayAppointments = useMemo(() => {
        return events
            .filter(evt => isSameDay(evt.start, date))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [events, date]);

    return (
        <div className="flex h-[calc(100vh-theme(spacing.8))] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-col">
            <style>{calendarStyles}</style>

            {/* Header */}
            <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <Popover>
                            <PopoverTrigger asChild>
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none capitalize cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-2 group">
                                    {format(date, 'd MMMM yyyy', { locale: tr })}
                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 rotate-90" />
                                </h1>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <MiniCalendar
                                    mode="single"
                                    selected={date}
                                    onSelect={(d) => d && setDate(d)}
                                    locale={tr}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        <span className="text-sm text-slate-400 font-medium mt-1 capitalize">
                            {format(date, 'EEEE', { locale: tr })}
                        </span>
                    </div>

                    <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm transition-all" onClick={() => handleNavigate('PREV')}>
                            <ChevronLeft className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-3 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm transition-all" onClick={() => handleNavigate('TODAY')}>
                            Bugün
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm transition-all" onClick={() => handleNavigate('NEXT')}>
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Zoom Control - Only show in Day/Week views */}
                    {(view === Views.DAY || view === Views.WEEK) && (
                        <div className="hidden md:flex items-center gap-2 mr-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
                            <Slider
                                value={[zoom]}
                                min={40}
                                max={200}
                                step={10}
                                onValueChange={(vals) => setZoom(vals[0])}
                                className="w-20"
                            />
                            <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                    )}

                    {/* Filter Button with Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-2 text-slate-600 border-slate-200">
                                <Settings2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Görünüm & Filtre</span>
                                {selectedDoctorIds.length > 0 && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-indigo-100 text-indigo-700 hover:bg-indigo-100 ml-1">
                                        {selectedDoctorIds.length}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-4" align="end">
                            <div className="space-y-6">
                                {/* Doctor Filter */}
                                <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-slate-900 border-b pb-2">Hekim Filtresi</h4>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {doctors.length === 0 && <span className="text-xs text-slate-500">Hekim bulunamadı.</span>}
                                        {doctors.map((doc: any) => (
                                            <div key={doc.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`filter-doc-${doc.id}`}
                                                    checked={selectedDoctorIds.includes(String(doc.id))}
                                                    onCheckedChange={() => handleDoctorToggle(String(doc.id))}
                                                />
                                                <label htmlFor={`filter-doc-${doc.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700">
                                                    {doc.full_name || doc.username}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Status Legend */}
                                <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-slate-900 border-b pb-2">Durum Renkleri</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white"></div>
                                            <span className="text-xs text-slate-600">Planlı</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                            <span className="text-xs text-slate-600">Onaylı</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                            <span className="text-xs text-slate-600">Ulaşılamadı</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                                            <span className="text-xs text-slate-600">İptal</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="bg-slate-100 rounded-lg p-1 flex">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-8 text-xs font-bold rounded-md px-3 transition-all", view === Views.DAY ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700")}
                            onClick={() => handleViewChange(Views.DAY)}
                        >
                            Gün
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-8 text-xs font-bold rounded-md px-3 transition-all", view === Views.WEEK ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700")}
                            onClick={() => handleViewChange(Views.WEEK)}
                        >
                            Hafta
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-8 text-xs font-bold rounded-md px-3 transition-all", view === Views.MONTH ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700")}
                            onClick={() => handleViewChange(Views.MONTH)}
                        >
                            Ay
                        </Button>
                    </div>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-9 px-4 font-bold text-sm"
                        onClick={() => {
                            setEditingAppointment(undefined);
                            setShowCreateDialog(true);
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Yeni Randevu
                    </Button>
                </div>
            </div>

            {/* Content Area: Calendar + Sidebar */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Calendar Grid */}
                <div className="flex-1 overflow-hidden p-0 relative h-full">
                    {/* @ts-ignore */}
                    <DnDCalendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: '100%' }}
                        culture='tr'
                        messages={messages}
                        view={view}
                        onView={setView}
                        date={date}
                        onNavigate={setDate}
                        scrollToTime={new Date()}
                        min={new Date(0, 0, 0, 8, 0, 0)}
                        max={new Date(0, 0, 0, 20, 0, 0)}
                        components={{
                            event: CustomEvent,
                            toolbar: CustomToolbar
                        }}
                        onEventDrop={onEventDrop}
                        onEventResize={onEventResize}
                        resizable
                        selectable
                        popup
                        step={30}
                        timeslots={2}
                        slotPropGetter={slotPropGetter}
                        dayPropGetter={dayPropGetter}
                        onSelectSlot={(slotInfo) => {
                            // Validate working hours
                            if (!isWithinWorkingHours(slotInfo.start)) {
                                toast.error('Çalışma saatleri dışında randevu oluşturulamaz.');
                                return;
                            }
                            setEditingAppointment(undefined);
                            setSelectedSlotStart(slotInfo.start);
                            setSelectedSlotEnd(slotInfo.end);
                            setShowCreateDialog(true);
                        }}
                        className="h-full border-none"
                    />
                </div>

                {/* Right Sidebar - Daily Appointments */}
                {showSidebar && (
                    <aside className="w-[320px] bg-white border-l border-slate-200 flex flex-col h-full shrink-0">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 text-sm">Günün Randevuları</h3>
                            <Badge variant="outline" className="text-xs font-normal text-slate-500">
                                {dayAppointments.length}
                            </Badge>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {dayAppointments.length === 0 ? (
                                <div className="text-center py-10 opacity-50">
                                    <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                    <p className="text-sm text-slate-500">Bugün için randevu yok.</p>
                                </div>
                            ) : (
                                dayAppointments.map((evt) => {
                                    const isPast = evt.end < new Date();
                                    const isNow = evt.start <= new Date() && evt.end >= new Date();

                                    return (
                                        <div
                                            key={evt.id}
                                            onClick={() => {
                                                setEditingAppointment(evt.resource);
                                                setShowCreateDialog(true);
                                            }}
                                            className={cn(
                                                "group flex gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md",
                                                evt.resource.status === 'blocked' ? "bg-red-50 border-red-200" : (isNow ? "bg-blue-50 border-blue-200" : "bg-white border-slate-100 hover:border-blue-100"),
                                                isPast && "opacity-60 bg-slate-50"
                                            )}
                                        >
                                            <div className="flex flex-col items-center justify-center w-12 rounded-lg bg-white border border-slate-100 shrink-0 h-12 shadow-sm">
                                                <span className="text-xs font-bold text-slate-800 leading-none mb-0.5">
                                                    {format(evt.start, 'HH')}
                                                </span>
                                                <span className="text-[10px] font-medium text-slate-400 leading-none">
                                                    {format(evt.start, 'mm')}
                                                </span>
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="font-bold text-sm text-slate-800 truncate leading-tight mb-1">
                                                    {evt.title}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {evt.resource.type && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full truncate max-w-[80px]">
                                                            {evt.resource.type}
                                                        </span>
                                                    )}
                                                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                                                        evt.resource.status === 'confirmed' ? "bg-emerald-500" :
                                                            evt.resource.status === 'unreachable' ? "bg-orange-500" :
                                                                evt.resource.status === 'cancelled' ? "bg-red-500" :
                                                                    "bg-blue-500"
                                                    )} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>
                )}

                {/* Sidebar Toggle Button */}
                <button
                    onClick={toggleSidebar}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white border border-slate-200 rounded-l-lg p-1.5 shadow-sm hover:bg-slate-50 transition-colors"
                    title={showSidebar ? 'Paneli Gizle' : 'Paneli Göster'}
                >
                    {showSidebar ? (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                    ) : (
                        <ChevronLeft className="w-4 h-4 text-slate-500" />
                    )}
                </button>
            </div>

            <CreateAppointmentDialog
                isOpen={showCreateDialog}
                onClose={() => {
                    setShowCreateDialog(false);
                    setEditingAppointment(undefined);
                    setSelectedSlotStart(undefined);
                    setSelectedSlotEnd(undefined);
                    queryClient.invalidateQueries({ queryKey: ['appointments'] });
                }}
                appointment={editingAppointment}
                existingAppointments={appointments || []}
                initialStart={selectedSlotStart}
                initialEnd={selectedSlotEnd}
            />

            <ExaminationSummaryDialog
                isOpen={summaryDialog.open}
                onClose={() => setSummaryDialog({ open: false })}
                patientId={summaryDialog.patientId}
                patientName={summaryDialog.patientName}
            />

            {/* Cancellation Dialog */}
            <Dialog open={cancelDialog.open} onOpenChange={(o) => setCancelDialog({ ...cancelDialog, open: o })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Randevu İptal Nedeni</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-2 py-4">
                        {cancelReasons.map(reason => (
                            <Button
                                key={reason}
                                variant="outline"
                                className="justify-start h-12 text-sm font-medium hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                onClick={() => {
                                    updateAppointmentMutation.mutate({
                                        id: cancelDialog.id!,
                                        data: { status: 'cancelled', cancel_reason: reason }
                                    });
                                    setCancelDialog({ open: false });
                                }}
                            >
                                {reason}
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Deletion Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ ...deleteDialog, open: o })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Randevu Silme Gerekçesi</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-sm text-slate-500 italic">Bu randevu takvimden kaldırılacak ancak hasta kayıtlarında silinme gerekçesiyle birlikte saklanacaktır.</p>
                        <textarea
                            className="w-full min-h-[100px] p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Silme nedenini buraya yazınız..."
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteDialog({ open: false })}>Vazgeç</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={!deleteReason.trim()}
                            onClick={() => {
                                deleteAppointmentMutation.mutate({ id: deleteDialog.id!, reason: deleteReason });
                                setDeleteDialog({ open: false });
                            }}
                        >
                            Randevuyu Sil
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
