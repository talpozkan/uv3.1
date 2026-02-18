"use client";

import { useState, useRef, useEffect } from "react";
import {
    Settings,
    Users,
    Database,
    Building2,
    CreditCard,
    Save,
    Plus,
    Trash2,
    Upload,
    Clock,
    UserCircle,
    Pencil,
    Loader2,
    Tag,
    Search,
    GripVertical,
    Heart,
    ShieldCheck,
    Brain,
    Zap,
    Activity
} from "lucide-react";
import { AuditLogsSettings } from "@/components/settings/audit-logs";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, SystemUser, SystemUserCreate, SystemSetting, SystemSettingCreate, ICDTani, ICDTaniCreate } from "@/lib/api";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { DoctorsSettings } from "@/components/settings/doctors-settings";
import { DrugsSettings } from "@/components/settings/drugs-settings";
import { PrescriptionTemplateSettings } from "@/components/settings/prescription-template-settings";
import { IntegrationsSettings } from "@/components/settings/integrations-settings";

interface DefinitionItem {
    id: string;
    value: string;
}

interface DefinitionState {
    [key: string]: DefinitionItem[];
}

// --- SUBSIDIARY COMPONENTS ---

const SortableItem = ({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 0,
        position: 'relative' as any,
    };

    return (
        <div ref={setNodeRef} style={style} className={cn(
            "group",
            className,
            isDragging && "shadow-xl border-blue-200 ring-4 ring-blue-500/10 z-50 opacity-90 scale-[1.02] bg-white"
        )}>
            <div
                {...attributes}
                {...listeners}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1 rounded-md hover:bg-slate-100/50 transition-colors z-10"
                title="Sıralamayı değiştir"
            >
                <GripVertical className="h-4 w-4" />
            </div>
            <div className="pl-6 w-full">
                {children}
            </div>
        </div>
    );
};

const AppointmentTypeRow = ({ item, index, onChange, onDelete }: { item: DefinitionItem, index: number, onChange: (i: number, val: string) => void, onDelete: (i: number) => void }) => {
    const parts = item.value.split('|');
    // Initialize state from props
    const [name, setName] = useState(parts[0]?.trim() || "");
    // Default duration "15" if missing
    const [duration, setDuration] = useState(parts[1]?.trim() || "15");
    const [color, setColor] = useState(parts[2]?.trim() || "#3b82f6");

    // Sync state if prop changes meaningfully (e.g. undo/redo or external update)
    useEffect(() => {
        const p = item.value.split('|');
        if (p[0]?.trim() !== name) setName(p[0]?.trim() || "");
        if (p[1]?.trim() !== duration) setDuration(p[1]?.trim() || "15");
        if (p[2]?.trim() !== color) setColor(p[2]?.trim() || "#3b82f6");
    }, [item.value]);

    const handleCommit = () => {
        onChange(index, `${name}|${duration}|${color}`);
    };

    const durations = ["10", "15", "20", "30", "40", "45", "60", "90", "120"];

    return (
        <SortableItem id={item.id}>
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm group">
                {/* Color Picker */}
                <div className="relative shrink-0">
                    <div
                        className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                        style={{ backgroundColor: color }}
                        title="Renk Seç"
                    >
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => {
                                setColor(e.target.value);
                                onChange(index, `${name}|${duration}|${e.target.value}`);
                            }}
                            className="opacity-0 w-[200%] h-[200%] cursor-pointer absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        />
                    </div>
                </div>

                {/* Service Name */}
                <div className="flex-1">
                    <div className="text-[10px] font-bold text-slate-400 mb-0.5 ml-1">HİZMET ADI</div>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleCommit}
                        className="h-9 border-slate-200 text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-colors"
                        placeholder="Örn: Muayene"
                    />
                </div>

                {/* Duration */}
                <div className="w-[110px]">
                    <div className="text-[10px] font-bold text-slate-400 mb-0.5 ml-1">SÜRE (DK)</div>
                    <div className="relative">
                        <select
                            value={duration}
                            onChange={(e) => {
                                setDuration(e.target.value);
                                onChange(index, `${name}|${e.target.value}|${color}`);
                            }}
                            className="w-full h-9 pl-2 pr-6 appearance-none bg-slate-50 border border-slate-200 rounded-md text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            {!durations.includes(duration) && <option value={duration}>{duration} dk</option>}
                            {durations.map(d => (
                                <option key={d} value={d}>{d} dk</option>
                            ))}
                        </select>
                        <Clock className="absolute right-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <button
                    onClick={() => onDelete(index)}
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-full ml-1"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>
        </SortableItem>
    );
};


class ExtendedKeyboardSensor extends KeyboardSensor {
    static activators = [
        {
            eventName: 'onKeyDown' as const,
            handler: ({ nativeEvent: event }: React.KeyboardEvent) => {
                if (
                    !event.defaultPrevented &&
                    ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)
                ) {
                    return false;
                }
                return true;
            },
        },
    ];
}

export default function SettingsPage() {
    // --- Store ---
    const {
        logoUrl, logoWidth, setLogoUrl, setLogoWidth, setDarkMode, setCompactMode,
        examinationModules, setExaminationModule,
        aiScribeEnabled, aiScribeMode,
        setAiScribeEnabled, setAiScribeMode,
        autoCapitalize, setAutoCapitalize
    } = useSettingsStore();
    const queryClient = useQueryClient();

    // --- DND Sensors ---
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(ExtendedKeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // --- State: General ---
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- API: Settings ---
    const { data: settings = [], isLoading: isLoadingSettings, refetch: refetchSettings } = useQuery({
        queryKey: ['settings'],
        queryFn: api.settings.getAll,
    });

    // Helper to find setting value
    const getSetting = (key: string) => settings.find((s: SystemSetting) => s.key === key)?.value || '';

    const updateSettingsMutation = useMutation({
        mutationFn: (data: SystemSettingCreate[]) => api.settings.batchUpdate(data),
        onSuccess: () => {
            refetchSettings();
            toast.success("Ayarlar kaydedildi.");
        },
        onError: () => toast.error("Ayarlar kaydedilemedi.")
    });

    const [clinicInfo, setClinicInfo] = useState({ name: '', phone: '', address: '', footer: '' });
    const [scribePath, setScribePath] = useState('static/recordings');
    const [saveTranscript, setSaveTranscript] = useState(false);

    // Sync from API to local state


    const handleSaveClinicInfo = () => {
        updateSettingsMutation.mutate([
            { key: 'clinic_name', value: clinicInfo.name },
            { key: 'clinic_phone', value: clinicInfo.phone },
            { key: 'clinic_address', value: clinicInfo.address },
            { key: 'clinic_footer', value: clinicInfo.footer }
        ]);
    };

    // Initialize preview from store on mount
    useEffect(() => {
        if (logoUrl) {
            setLogoPreview(logoUrl);
        }
    }, [logoUrl]);

    // --- State: Working Hours ---
    const [workingHours, setWorkingHours] = useState<Record<string, { isOpen: boolean, start: string, end: string }>>({
        monday: { isOpen: true, start: "09:00", end: "18:00" },
        tuesday: { isOpen: true, start: "09:00", end: "18:00" },
        wednesday: { isOpen: true, start: "09:00", end: "18:00" },
        thursday: { isOpen: true, start: "09:00", end: "18:00" },
        friday: { isOpen: true, start: "09:00", end: "18:00" },
        saturday: { isOpen: true, start: "09:00", end: "14:00" },
        sunday: { isOpen: false, start: "09:00", end: "18:00" },
    });



    const handleSaveWorkingHours = () => {
        updateSettingsMutation.mutate([
            { key: 'working_hours', value: JSON.stringify(workingHours) }
        ]);
    };

    // --- State: Theme ---
    const [themeSettings, setThemeSettings] = useState({ darkMode: false, compactMode: false });

    // Sync from API to local state
    useEffect(() => {
        if (settings.length > 0) {
            setClinicInfo({
                name: getSetting('clinic_name'),
                phone: getSetting('clinic_phone'),
                address: getSetting('clinic_address'),
                footer: getSetting('clinic_footer')
            });
            const wh = getSetting('working_hours');
            if (wh) {
                try {
                    const parsed = JSON.parse(wh);
                    // Check if it is the old format (has weekdayStart)
                    if (parsed.weekdayStart) {
                        const newFormat: any = {
                            monday: { isOpen: true, start: parsed.weekdayStart, end: parsed.weekdayEnd },
                            tuesday: { isOpen: true, start: parsed.weekdayStart, end: parsed.weekdayEnd },
                            wednesday: { isOpen: true, start: parsed.weekdayStart, end: parsed.weekdayEnd },
                            thursday: { isOpen: true, start: parsed.weekdayStart, end: parsed.weekdayEnd },
                            friday: { isOpen: true, start: parsed.weekdayStart, end: parsed.weekdayEnd },
                            saturday: { isOpen: parsed.isWeekendActive, start: parsed.weekendStart || "09:00", end: parsed.weekendEnd || "14:00" },
                            sunday: { isOpen: false, start: "09:00", end: "18:00" },
                        };
                        setWorkingHours(newFormat);
                    } else {
                        setWorkingHours(parsed);
                    }
                } catch (e) {
                    console.error("Error parsing working hours", e);
                }
            }
            const defs = getSetting('system_definitions');
            if (defs) {
                try {
                    const parsed = JSON.parse(defs);
                    // Only keep keys that exist in our initial definitions state
                    const filtered: any = {};
                    Object.keys(definitions).forEach(key => {
                        let sourceArray = parsed[key];
                        if (key === 'Takip Konuları' && (!sourceArray || sourceArray.length === 0)) {
                            sourceArray = parsed['Hizmet Tanımları'];
                        }

                        if (sourceArray && Array.isArray(sourceArray) && sourceArray.length > 0) {
                            // Convert string array to DefinitionItem array with stable IDs if possible
                            filtered[key] = sourceArray.map((v: string) => {
                                // Try to find existing item with same value to preserve ID
                                const existing = definitions[key]?.find(ex => ex.value === v);
                                return {
                                    id: existing?.id || Math.random().toString(36).substring(2, 11),
                                    value: v
                                };
                            });
                        }
                    });
                    setDefinitions(prev => ({ ...prev, ...filtered }));
                } catch (e) {
                    console.error("Error parsing definitions", e);
                }
            }
            const dark = getSetting('theme_dark_mode') === 'true';
            const compact = getSetting('theme_compact') === 'true';
            setThemeSettings({
                darkMode: dark,
                compactMode: compact
            });
            setDarkMode(dark);
            setCompactMode(compact);

            const logo = getSetting('system_logo_url');
            if (logo) {
                setLogoUrl(logo);
                setLogoPreview(logo);
            }
            const width = getSetting('system_logo_width');
            if (width) setLogoWidth(Number(width));
        }
    }, [settings]);

    const handleSaveTheme = (newSettings: any) => {
        updateSettingsMutation.mutate([
            { key: 'theme_dark_mode', value: String(newSettings.darkMode) },
            { key: 'theme_compact', value: String(newSettings.compactMode) }
        ]);
        setDarkMode(newSettings.darkMode);
        setCompactMode(newSettings.compactMode);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setDefinitions((prev) => {
                const currentList = prev[activeDefinition];
                const oldIndex = currentList.findIndex(item => item.id === active.id);
                const newIndex = currentList.findIndex(item => item.id === over.id);

                if (oldIndex === -1 || newIndex === -1) return prev;

                const newArray = arrayMove(currentList, oldIndex, newIndex);
                const newState = { ...prev, [activeDefinition]: newArray };

                // Auto-save reordered state (convert back to strings for DB)
                const dbState: any = {};
                Object.keys(newState).forEach(k => {
                    dbState[k] = newState[k].map(item => item.value);
                });

                updateSettingsMutation.mutate([
                    { key: 'system_definitions', value: JSON.stringify(dbState) }
                ]);

                return newState;
            });
        }
    };

    // --- State: Definitions ---
    const [activeDefinition, setActiveDefinition] = useState('Kurumlar');
    const [definitions, setDefinitions] = useState<DefinitionState>(() => {
        const initialStrings: Record<string, string[]> = {
            'Doktorlar': [],
            'Kurumlar': ['SGK (Sosyal Güvenlik Kurumu)', 'Bağkur', 'Emekli Sandığı', 'Yurtdışı Sigortası', 'Ücretli Hasta', 'Özel Sigorta'],
            'Meslekler': ['Memur', 'İşçi', 'Emekli', 'Serbest', 'Ev Hanımı', 'Öğrenci'],
            'Özel Sigortalar': ['Allianz', 'Acıbadem', 'Anadolu Sigorta', 'Mapfre', 'Axa'],
            'ICD-10 Tanıları': [],
            'Takip Konuları': [
                'KONTROL',
                'PANSUMAN',
                'TAHLİL SONUCU',
                'REÇETE YAZIMI',
                'MÜDAHALE',
                'AMELİYAT KARARI',
                'GÖRÜŞME',
                'DİĞER'
            ],
            'Tıbbi Müdahale Şablonları': [
                "Sonda Takılması (Üretral Kateterizasyon)|Hastaya steril koşullarda, uygun boyutta Foley kateter uygulandı. Balon SF ile şişirilerek sabitlendi. Aktif idrar çıkışı gözlendi.",
                "Basit Cerrahi Müdahale|Lokal anestezi altında lezyon eksize edildi. Kanama kontrolü yapıldı. Primer sütürize edildi.",
                "Pansuman|Mevcut yara/insizyon bölgesi aseptik solüsyonlarla temizlendi. Steril pansuman ile kapatıldı."
            ],
            'Görüntüleme Tetkik Tanımları': ['Tüm Batın USG', 'Üriner Sistem USG', 'Scrotal USG', 'Transrektal USG', 'BT', 'MR', 'DÜSG'],
            'Ameliyat Not Şablonları': [
                'Sistoskopi | Üretra ve mesane gözlemlendi. Patoloji saptanmadı.',
                'Sünnet | Steril şartlarda sünnet işlemi uygulandı. Hemostaz sağlandı.'
            ],
            'Ameliyat Ekibi': [
                'Cerrah | ',
                'Anestezi | ',
                'Hemşire | '
            ],
            'Anestezi Tipi': ['Genel', 'Spinal', 'Epidural', 'Lokal', 'Sedasyon'],
            'Randevu Türleri': [
                'Muayene | 30 | #ef4444',
                'Kontrol | 15 | #3b82f6',
                'Operasyon | 120 | #8b5cf6',
                'Görüşme | 20 | #6b7280'
            ],
            'TRUS Biyopsi Şablonu': [
                '1 | Sağ Bazal',
                '2 | Sağ Medial',
                '3 | Sağ Apex',
                '4 | Sol Bazal',
                '5 | Sol Medial',
                '6 | Sol Apex',
                '7 | Sağ Transizyonel',
                '8 | Sol Transizyonel',
                '9 | Sağ Seminal Vezikül',
                '10 | Sol Seminal Vezikül',
                '11 | Sağ Lateral',
                '12 | Sol Lateral'
            ]
        };
        const state: DefinitionState = {};
        Object.keys(initialStrings).forEach(key => {
            state[key] = initialStrings[key].map(v => ({ id: Math.random().toString(36).substring(2, 11), value: v }));
        });
        return state;
    });

    // --- API: Users ---
    const { data: users = [], isLoading: isLoadingUsers } = useQuery({
        queryKey: ['users'],
        queryFn: api.auth.getUsers,
    });

    const createUserMutation = useMutation({
        mutationFn: (data: SystemUserCreate) => api.auth.createUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success("Yeni kullanıcı oluşturuldu.");
            setIsUserDialogOpen(false);
            resetUserForm();
        },
        onError: (error: any) => {
            toast.error(error?.message || "Kullanıcı oluşturulamadı.");
        }
    });

    const updateUserMutation = useMutation({
        mutationFn: ({ id, data }: { id: number, data: Partial<SystemUserCreate> }) => api.auth.updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success("Kullanıcı güncellendi.");
            setIsUserDialogOpen(false);
            resetUserForm();
        },
        onError: (error: any) => {
            toast.error(error?.message || "Kullanıcı güncellenemedi.");
        }
    });

    const deleteUserMutation = useMutation({
        mutationFn: (id: number) => api.auth.deleteUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success("Kullanıcı silindi.");
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        },
        onError: (error: any) => {
            toast.error(error?.message || "Kullanıcı silinemedi.");
        }
    });

    // --- State: User Dialog ---
    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<number | null>(null);
    const [newUser, setNewUser] = useState({
        full_name: '',
        username: '',
        password: '',
        email: '',
        role: 'DOCTOR' as string,
        is_active: true,
        is_superuser: false,
    });
    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [confirmPassword, setConfirmPassword] = useState('');


    // Handlers: Logo
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                toast.error("Dosya boyutu 10MB'dan büyük olamaz.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
                toast.success("Logo seçildi. Kaydetmek için 'Yükle' butonuna basınız.");
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveLogo = () => {
        if (logoPreview) {
            setLogoUrl(logoPreview);
            updateSettingsMutation.mutate([
                { key: 'system_logo_url', value: logoPreview },
                { key: 'system_logo_width', value: String(logoWidth) }
            ]);
            // toast success handled by mutation
        }
    };

    // Handlers: Users
    const handleSaveUser = () => {
        if (!newUser.full_name || !newUser.email) {
            toast.error("Lütfen ad ve e-posta adresi giriniz.");
            return;
        }

        if (newUser.password !== confirmPassword) {
            toast.error("Şifreler eşleşmiyor.");
            return;
        }

        if (!editingUserId && !newUser.password) {
            toast.error("Yeni kullanıcı için şifre gereklidir.");
            return;
        }

        const userData: any = {
            full_name: newUser.full_name,
            email: newUser.email,
            role: newUser.role,
            is_active: newUser.is_active,
            is_superuser: newUser.role === 'ADMIN' || newUser.is_superuser,
        };

        if (newUser.password) {
            userData.password = newUser.password;
        }

        if (editingUserId) {
            updateUserMutation.mutate({ id: editingUserId, data: userData });
        } else {
            createUserMutation.mutate(userData as any);
        }
    };

    const handleEditUser = (user: SystemUser) => {
        setNewUser({
            full_name: user.full_name || '',
            username: user.username,
            role: user.role || 'DOCTOR',
            password: '',
            email: user.email || '',
            is_active: user.is_active,
            is_superuser: user.is_superuser
        });
        setEditingUserId(user.id);
        setConfirmPassword('');
        setIsUserDialogOpen(true);
    };

    const handleDeleteUser = (id: number) => {
        setUserToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const resetUserForm = () => {
        setNewUser({ full_name: '', username: '', role: 'DOCTOR', password: '', email: '', is_active: true, is_superuser: false });
        setConfirmPassword('');
        setEditingUserId(null);
    };

    // Handlers: Definitions
    const handleAddDefinition = () => {
        let newValue = "Yeni Kayıt";
        if (activeDefinition === 'Ameliyat Not Şablonları' || activeDefinition === 'Tıbbi Müdahale Şablonları') {
            newValue = activeDefinition === 'Tıbbi Müdahale Şablonları'
                ? "Yeni İşlem | Müdahale Detayları"
                : "Yeni Ameliyat | Not İçeriği";
        } else if (activeDefinition === 'Ameliyat Ekibi') {
            newValue = "Cerrah | Yeni İsim";
        } else if (activeDefinition === 'Randevu Türleri') {
        } else if (activeDefinition === 'Doktorlar') {
            newValue = "Dr. İsim Soyisim";
        }

        const newItem = { id: Math.random().toString(36).substring(2, 11), value: newValue };

        setDefinitions(prev => ({
            ...prev,
            [activeDefinition]: [newItem, ...prev[activeDefinition]]
        }));
    };

    const handleDefinitionChange = (index: number, value: string) => {
        setDefinitions(prev => {
            const newList = [...prev[activeDefinition]];
            newList[index] = { ...newList[index], value };
            return {
                ...prev,
                [activeDefinition]: newList
            };
        });
    };

    const handleDeleteDefinition = (index: number) => {
        const newList = definitions[activeDefinition].filter((_, i) => i !== index);
        setDefinitions(prev => ({
            ...prev,
            [activeDefinition]: newList
        }));
    };

    const handleSaveDefinitions = () => {
        // Categories that should be saved in uppercase
        const uppercaseCategories = [
            'Takip Konuları',
            'Görüntüleme Tetkik Tanımları',
            'Ameliyat Not Şablonları',
            'Tıbbi Müdahale Şablonları'
        ];

        const dbState: any = {};
        Object.keys(definitions).forEach(k => {
            if (uppercaseCategories.includes(k)) {
                // Convert to uppercase for these categories
                dbState[k] = definitions[k].map(item => item.value.toLocaleUpperCase('tr-TR'));
            } else {
                dbState[k] = definitions[k].map(item => item.value);
            }
        });

        updateSettingsMutation.mutate([
            { key: 'system_definitions', value: JSON.stringify(dbState) }
        ]);
        toast.success(`${activeDefinition} listesi kaydedildi.`);
    };

    // --- State: ICD Management ---
    const [newICD, setNewICD] = useState<{ kodu: string, adi: string }>({ kodu: '', adi: '' });
    const [massIcdText, setMassIcdText] = useState("");
    const [isMassImporting, setIsMassImporting] = useState(false);
    const [icdSearch, setIcdSearch] = useState("");
    const [icdResults, setIcdResults] = useState<ICDTani[]>([]);
    const [isICDLoading, setIsICDLoading] = useState(false);
    const [selectedIcdIds, setSelectedIcdIds] = useState<number[]>([]);

    useEffect(() => {
        if (activeDefinition === 'ICD-10 Tanıları') {
            handleSearchICD("");
        }
    }, [activeDefinition]);

    const handleSearchICD = async (query: string) => {
        setIcdSearch(query);
        setIsICDLoading(true);
        try {
            const results = await api.system.search_icd(query || undefined, 0, 500);
            setIcdResults(results);
        } catch (e) {
            console.error("ICD search error", e);
        } finally {
            setIsICDLoading(false);
        }
    };

    const handleCreateICD = async () => {
        if (!newICD.kodu || !newICD.adi) {
            toast.error("Kod ve Tanı adı zorunludur.");
            return;
        }
        try {
            await api.system.create_icd(newICD);
            toast.success("Yeni ICD kodu başarıyla eklendi.");
            setNewICD({ kodu: '', adi: '' });
            if (icdSearch) handleSearchICD(icdSearch);
        } catch (e: any) {
            toast.error(e?.message || "ICD kodu eklenemedi.");
        }
    };

    const handleMassImport = async () => {
        if (!massIcdText.trim()) return;
        setIsMassImporting(true);
        const lines = massIcdText.split('\n');
        let count = 0;
        let errors = 0;

        for (const line of lines) {
            if (!line.trim()) continue;
            // Split by tab, space or pipe
            const parts = line.trim().split(/[\t|]+/);
            let kodu = "";
            let adi = "";

            if (parts.length >= 2) {
                kodu = parts[0].trim().toUpperCase();
                adi = parts.slice(1).join(' ').trim();
            } else {
                // Try splitting by space but keep the first word as code
                const spaceParts = line.trim().split(/\s+/);
                if (spaceParts.length >= 2) {
                    kodu = spaceParts[0].trim().toUpperCase();
                    adi = spaceParts.slice(1).join(' ').trim();
                }
            }

            if (kodu && adi) {
                try {
                    await api.system.create_icd({ kodu, adi });
                    count++;
                } catch (e) {
                    errors++;
                }
            }
        }

        setIsMassImporting(false);
        toast.success(`${count} adet ICD kodu başarıyla eklendi.`);
        if (errors > 0) toast.warning(`${errors} kayıt mükerrer olabilir veya hata oluştu.`);
        setMassIcdText("");
        handleSearchICD(icdSearch);
    };

    const handleBatchDeleteICD = async () => {
        if (selectedIcdIds.length === 0) return;
        if (!confirm(`${selectedIcdIds.length} adet ICD kodunu silmek istediğinizden emin misiniz?`)) return;

        try {
            await api.system.delete_batch_icd(selectedIcdIds);
            toast.success("Seçilen ICD kodları silindi.");
            setSelectedIcdIds([]);
            handleSearchICD(icdSearch);
        } catch (e: any) {
            toast.error(e?.message || "Silme işlemi başarısız oldu.");
        }
    };

    const toggleIcdSelection = (id: number) => {
        setSelectedIcdIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="flex h-full flex-col gap-6 p-6 bg-slate-50/50 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <Settings className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">Sistem Ayarları</h2>
                        <div className="text-xs text-slate-500">
                            Uygulama yapılandırması, kullanıcılar ve tanımlamalar
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1">
                <Tabs defaultValue="general" className="space-y-6">
                    <TabsList className="bg-white p-1 border border-slate-200 rounded-xl w-full justify-start h-12">
                        <TabsTrigger value="general" className="flex items-center gap-2 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                            <Building2 className="h-4 w-4" /> Genel & Kurum
                        </TabsTrigger>
                        <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                            <Users className="h-4 w-4" /> Kullanıcılar & Yetki
                        </TabsTrigger>
                        <TabsTrigger value="definitions" className="flex items-center gap-2 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                            <Database className="h-4 w-4" /> Tanımlar
                        </TabsTrigger>
                        <TabsTrigger value="integrations" className="flex items-center gap-2 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                            <Zap className="h-4 w-4" /> Entegrasyonlar
                        </TabsTrigger>
                        <TabsTrigger value="audit" className="flex items-center gap-2 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900">
                            <ShieldCheck className="h-4 w-4" /> Denetim Kayıtları
                        </TabsTrigger>

                    </TabsList>

                    {/* GENERAL SETTINGS */}
                    <TabsContent value="general">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            {/* Klinik Bilgileri & Logo - Combined Card */}
                            <Card className="border-slate-100 shadow-sm md:col-span-2">
                                <CardHeader className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Building2 className="h-3.5 w-3.5 text-teal-500" />
                                            Klinik Bilgileri & Logo
                                        </CardTitle>
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={handleSaveClinicInfo} disabled={updateSettingsMutation.isPending}>
                                            {updateSettingsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 pt-0">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Left: Clinic Info */}
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <Label className="text-[10px] text-slate-500">Klinik Adı</Label>
                                                    <Input value={clinicInfo.name} onChange={(e) => setClinicInfo(prev => ({ ...prev, name: e.target.value }))} placeholder="Klinik adı" className="h-8 text-xs" />
                                                </div>
                                                <div>
                                                    <Label className="text-[10px] text-slate-500">Telefon</Label>
                                                    <Input value={clinicInfo.phone} onChange={(e) => setClinicInfo(prev => ({ ...prev, phone: e.target.value }))} placeholder="+90 212 555 00 00" className="h-8 text-xs" />
                                                </div>
                                            </div>
                                            <div>
                                                <Label className="text-[10px] text-slate-500">Adres</Label>
                                                <Input value={clinicInfo.address} onChange={(e) => setClinicInfo(prev => ({ ...prev, address: e.target.value }))} placeholder="Adres" className="h-8 text-xs" />
                                            </div>
                                            <div>
                                                <Label className="text-[10px] text-slate-500">Kaşe / Alt Bilgi</Label>
                                                <Textarea value={clinicInfo.footer} onChange={(e) => setClinicInfo(prev => ({ ...prev, footer: e.target.value }))} placeholder="Dr. Ad Soyad - Dip. No: ..." className="min-h-[50px] text-xs" />
                                            </div>
                                        </div>

                                        {/* Right: Logo */}
                                        <div className="space-y-3 md:border-l md:pl-4 border-slate-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Upload className="h-3.5 w-3.5 text-blue-500" />
                                                <span className="text-xs font-semibold text-slate-600">Logo</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="h-16 w-16 shrink-0 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors overflow-hidden"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    {logoPreview ? (
                                                        <img src={logoPreview} alt="Logo" className="object-contain w-full h-full" />
                                                    ) : (
                                                        <Upload className="h-5 w-5 text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-[10px] text-slate-400">PNG/JPG, max 10MB</p>
                                                    <div className="flex gap-1.5">
                                                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => fileInputRef.current?.click()}>Seç</Button>
                                                        <Button size="sm" className="h-7 text-xs px-2" onClick={handleSaveLogo} disabled={!logoPreview || logoPreview === logoUrl}>Yükle</Button>
                                                    </div>
                                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs">Genişlik</Label>
                                                    <span className="text-[10px] font-mono text-slate-400">{logoWidth}px</span>
                                                </div>
                                                <Slider value={[logoWidth]} onValueChange={(vals) => setLogoWidth(vals[0])} max={200} min={50} step={1} className="w-full" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Çalışma Saatleri - Compact */}
                            <Card className="border-slate-100 shadow-sm md:row-span-2">
                                <CardHeader className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Clock className="h-3.5 w-3.5 text-orange-500" />
                                            Çalışma Saatleri
                                        </CardTitle>
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={handleSaveWorkingHours}>
                                            <Save className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 pt-0">
                                    <div className="space-y-1.5">
                                        {[
                                            { key: 'monday', label: 'Pzt' },
                                            { key: 'tuesday', label: 'Sal' },
                                            { key: 'wednesday', label: 'Çar' },
                                            { key: 'thursday', label: 'Per' },
                                            { key: 'friday', label: 'Cum' },
                                            { key: 'saturday', label: 'Cmt' },
                                            { key: 'sunday', label: 'Paz' }
                                        ].map((day) => {
                                            const daySettings = workingHours[day.key] || { isOpen: false, start: "09:00", end: "18:00" };
                                            return (
                                                <div key={day.key} className={cn(
                                                    "flex items-center gap-2 py-1 px-2 rounded-md border transition-colors",
                                                    daySettings.isOpen ? "bg-white border-slate-200" : "bg-slate-50 border-transparent opacity-60"
                                                )}>
                                                    <Switch
                                                        checked={daySettings.isOpen}
                                                        onCheckedChange={(checked) => setWorkingHours(prev => ({ ...prev, [day.key]: { ...prev[day.key], isOpen: checked } }))}
                                                        className="scale-[0.6] data-[state=checked]:bg-green-500"
                                                    />
                                                    <Label className={cn("text-[10px] font-bold w-6", daySettings.isOpen ? "text-slate-700" : "text-slate-400")}>{day.label}</Label>
                                                    {daySettings.isOpen ? (
                                                        <div className="flex items-center gap-1 flex-1">
                                                            <Input type="time" value={daySettings.start} onChange={(e) => setWorkingHours(prev => ({ ...prev, [day.key]: { ...prev[day.key], start: e.target.value } }))} className="h-6 text-[10px] px-1 w-[70px]" />
                                                            <span className="text-slate-300 text-[10px]">-</span>
                                                            <Input type="time" value={daySettings.end} onChange={(e) => setWorkingHours(prev => ({ ...prev, [day.key]: { ...prev[day.key], end: e.target.value } }))} className="h-6 text-[10px] px-1 w-[70px]" />
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 italic flex-1 text-center">Kapalı</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* AI Scribe & Metin Ayarları - Combined Compact */}
                            <Card className="border-slate-100 shadow-sm md:col-span-2">
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Settings className="h-3.5 w-3.5 text-slate-500" />
                                        Gelişmiş Ayarlar
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 pt-0">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {/* AI Katip */}
                                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Brain className="h-4 w-4 text-purple-500" />
                                                    <div>
                                                        <Label className="text-xs font-bold">AI Katip</Label>
                                                        <p className="text-[10px] text-slate-400">Sesli notları raporla</p>
                                                    </div>
                                                </div>
                                                <Switch checked={aiScribeEnabled} onCheckedChange={setAiScribeEnabled} className="scale-90 data-[state=checked]:bg-purple-600" />
                                            </div>
                                            {aiScribeEnabled && (
                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        onClick={() => setAiScribeMode('gemini')}
                                                        className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border text-[10px] font-medium transition-all",
                                                            aiScribeMode === 'gemini' ? "border-purple-200 bg-purple-50 text-purple-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <Brain className="h-3 w-3" /> Bulut
                                                    </button>
                                                    <button
                                                        onClick={() => setAiScribeMode('local')}
                                                        className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border text-[10px] font-medium transition-all",
                                                            aiScribeMode === 'local' ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <Zap className="h-3 w-3" /> Yerel
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Otomatik Büyük Harf */}
                                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Activity className="h-4 w-4 text-green-500" />
                                                    <div>
                                                        <Label className="text-xs font-bold">Otomatik Büyük Harf</Label>
                                                        <p className="text-[10px] text-slate-400">Tüm metin girişlerini BÜYÜK HARFE çevir</p>
                                                    </div>
                                                </div>
                                                <Switch checked={autoCapitalize} onCheckedChange={setAutoCapitalize} className="scale-90 data-[state=checked]:bg-green-600" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>
                    </TabsContent>

                    {/* USERS */}
                    <TabsContent value="users">
                        <Card className="border-white shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Kullanıcı Yönetimi</CardTitle>
                                    <CardDescription>Doktor ve sekreter hesapları, yetkilendirme</CardDescription>
                                </div>
                                <Dialog open={isUserDialogOpen} onOpenChange={(val) => { setIsUserDialogOpen(val); if (!val) resetUserForm(); }}>
                                    <DialogTrigger asChild>
                                        <Button size="sm">
                                            <Plus className="h-4 w-4 mr-2" /> Yeni Kullanıcı
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[500px]">
                                        <DialogHeader>
                                            <DialogTitle>{editingUserId ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}</DialogTitle>
                                            <DialogDescription>
                                                Kullanıcı bilgilerini ve yetki seviyesini belirleyin.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Ad Soyad</Label>
                                                <Input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} placeholder="Örn: Dr. Ali Veli" />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>E-posta (Giriş Kimliği)</Label>
                                                    <Input
                                                        type="email"
                                                        value={newUser.email}
                                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value, username: e.target.value })}
                                                        placeholder="ornek@email.com"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Şifre {editingUserId && <span className="text-xs text-slate-400 font-normal">(Değiştirme: Boş Bırakın)</span>}</Label>
                                                    <Input
                                                        type="password"
                                                        value={newUser.password}
                                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                                        placeholder="******"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Şifre Tekrar</Label>
                                                    <Input
                                                        type="password"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        placeholder="******"
                                                        className={newUser.password && confirmPassword && newUser.password !== confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-sm font-semibold">Yetki Seviyesi (Rol)</Label>
                                                <div className="grid grid-cols-1 gap-3">
                                                    <label className={cn(
                                                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                        newUser.role === 'ADMIN' ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                                                    )}>
                                                        <input
                                                            type="radio"
                                                            name="role"
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                                            checked={newUser.role === 'ADMIN'}
                                                            onChange={() => setNewUser({ ...newUser, role: 'ADMIN', is_superuser: true })}
                                                        />
                                                        <div>
                                                            <div className="font-medium text-sm text-slate-900">Tam Yetki (Yönetici)</div>
                                                            <div className="text-xs text-slate-500">Tüm ayarlara ve kayıtlara tam erişim.</div>
                                                        </div>
                                                    </label>

                                                    <label className={cn(
                                                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                        newUser.role === 'DOCTOR' ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                                                    )}>
                                                        <input
                                                            type="radio"
                                                            name="role"
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                                            checked={newUser.role === 'DOCTOR'}
                                                            onChange={() => setNewUser({ ...newUser, role: 'DOCTOR', is_superuser: false })}
                                                        />
                                                        <div>
                                                            <div className="font-medium text-sm text-slate-900">Klinik & Hasta Yönetimi (Doktor)</div>
                                                            <div className="text-xs text-slate-500">Hasta kayıtları, muayene ve operasyon yönetimi.</div>
                                                        </div>
                                                    </label>

                                                    <label className={cn(
                                                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                        newUser.role === 'NURSE' ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                                                    )}>
                                                        <input
                                                            type="radio"
                                                            name="role"
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                                            checked={newUser.role === 'NURSE'}
                                                            onChange={() => setNewUser({ ...newUser, role: 'NURSE', is_superuser: false })}
                                                        />
                                                        <div>
                                                            <div className="font-medium text-sm text-slate-900">Hemşire</div>
                                                            <div className="text-xs text-slate-500">Hasta takibi ve tedavi yönetimi.</div>
                                                        </div>
                                                    </label>

                                                    <label className={cn(
                                                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                        newUser.role === 'SECRETARY' ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                                                    )}>
                                                        <input
                                                            type="radio"
                                                            name="role"
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                                            checked={newUser.role === 'SECRETARY'}
                                                            onChange={() => setNewUser({ ...newUser, role: 'SECRETARY', is_superuser: false })}
                                                        />
                                                        <div>
                                                            <div className="font-medium text-sm text-slate-900">Randevu & Kayıt (Sekreter)</div>
                                                            <div className="text-xs text-slate-500">Sadece hasta kaydı ve randevu işlemleri.</div>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>

                                            {editingUserId && (
                                                <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                                    <div className="space-y-0.5">
                                                        <Label className="text-sm font-medium">Kullanıcı Durumu</Label>
                                                        <div className="text-xs text-slate-500">Kullanıcının sisteme giriş yapabilmesi</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn("text-xs font-bold", newUser.is_active ? "text-emerald-600" : "text-red-600")}>
                                                            {newUser.is_active ? 'AKTİF' : 'PASİF'}
                                                        </span>
                                                        <Switch
                                                            checked={newUser.is_active}
                                                            onCheckedChange={(checked) => setNewUser({ ...newUser, is_active: checked })}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <DialogFooter>
                                            <Button variant="ghost" onClick={() => setIsUserDialogOpen(false)}>İptal</Button>
                                            <Button onClick={handleSaveUser} disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                                                {(createUserMutation.isPending || updateUserMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Kaydet
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border border-slate-200">
                                    <div className="grid grid-cols-12 gap-4 p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                                        <div className="col-span-4">Ad Soyad</div>
                                        <div className="col-span-3">E-posta</div>
                                        <div className="col-span-2">Rol</div>
                                        <div className="col-span-2 text-right">Durum</div>
                                        <div className="col-span-1 text-center">İşlem</div>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {isLoadingUsers ? (
                                            <div className="p-8 text-center text-slate-400">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                                Yükleniyor...
                                            </div>
                                        ) : users.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400">
                                                Henüz kullanıcı bulunmuyor.
                                            </div>
                                        ) : (
                                            users.map((user) => (
                                                <div key={user.id} className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-slate-50 transition-colors">
                                                    <div className="col-span-4 font-medium text-slate-900 flex items-center gap-2">
                                                        <UserCircle className="h-5 w-5 text-slate-400" />
                                                        {user.full_name || user.email || user.username}
                                                    </div>
                                                    <div className="col-span-3 text-slate-600 truncate" title={user.email || user.username}>
                                                        {user.email || user.username}
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className={cn(
                                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                            user.role === 'ADMIN' ? "bg-purple-100 text-purple-700" :
                                                                user.role === 'DOCTOR' ? "bg-blue-100 text-blue-700" :
                                                                    user.role === 'NURSE' ? "bg-green-100 text-green-700" :
                                                                        "bg-slate-100 text-slate-700"
                                                        )}>
                                                            {user.role === 'ADMIN' ? 'Yönetici' :
                                                                user.role === 'DOCTOR' ? 'Doktor' :
                                                                    user.role === 'NURSE' ? 'Hemşire' : 'Sekreter'}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2 text-right">
                                                        <span className={cn("text-xs font-bold", user.is_active ? "text-emerald-600" : "text-red-600")}>
                                                            {user.is_active ? 'Aktif' : 'Pasif'}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-1 flex justify-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-blue-600" onClick={() => handleEditUser(user)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => handleDeleteUser(user.id)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* DEFINITIONS */}
                    <TabsContent value="definitions">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Definition Categories Sidebar */}
                            <Card className="border-white shadow-sm lg:col-span-1 h-fit">
                                <CardHeader>
                                    <CardTitle className="text-base">Tanım Listeleri</CardTitle>
                                    <CardDescription>Düzenlemek istediğiniz listeyi seçin</CardDescription>
                                </CardHeader>
                                <CardContent className="p-2">
                                    <div className="space-y-4">
                                        {[
                                            { label: "MUAYENE MODÜLLERİ", items: ["ED Modülü", "Fizik Muayene (PE)", "Arap PE"] },
                                            { label: "GENEL", items: ["Doktorlar", "Kurumlar", "Meslekler", "Özel Sigortalar"] },
                                            { label: "AMELİYAT", items: ["Ameliyat Ekibi", "Anestezi Tipi", "Ameliyat Not Şablonları"] },
                                            { label: "TIBBİ", items: ["ICD-10 Tanıları", "Tıbbi Müdahale Şablonları", "Görüntüleme Tetkik Tanımları", "Takip Konuları", "Reçete Şablonları", "İlaç Listesi", "TRUS Biyopsi Şablonu"] },
                                            { label: "RANDEVU", items: ["Randevu Türleri"] }
                                        ].map((group) => (
                                            <div key={group.label} className="space-y-1">
                                                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    {group.label}
                                                </div>
                                                {group.items.map((item) => (
                                                    <Button
                                                        key={item}
                                                        variant={activeDefinition === item ? "secondary" : "ghost"}
                                                        className={cn(
                                                            "w-full justify-start text-sm h-9 px-3",
                                                            activeDefinition === item ? "font-semibold bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700" : "text-slate-600"
                                                        )}
                                                        onClick={() => setActiveDefinition(item)}
                                                    >
                                                        {item}
                                                    </Button>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Active Definition Editor */}
                            <Card className="border-white shadow-sm lg:col-span-2">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">{activeDefinition}</CardTitle>
                                        <CardDescription>Seçilen liste için kayıtlar</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {activeDefinition === 'ED Modülü' ? (
                                        <div className="space-y-6">
                                            <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                                                            <Heart className="h-6 w-6 text-white" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-slate-800">ED Modülü</h3>
                                                            <p className="text-sm text-slate-600">Erektil Disfonksiyon Değerlendirme Formu</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn(
                                                            "text-sm font-bold",
                                                            examinationModules.edModule ? "text-emerald-600" : "text-slate-400"
                                                        )}>
                                                            {examinationModules.edModule ? 'AKTİF' : 'PASİF'}
                                                        </span>
                                                        <Switch
                                                            checked={examinationModules.edModule}
                                                            onCheckedChange={(checked) => setExaminationModule('edModule', checked)}
                                                            className="data-[state=checked]:bg-emerald-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mt-6 p-4 bg-white/50 rounded-lg border border-white">
                                                    <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Modül Açıklaması</h4>
                                                    <p className="text-sm text-slate-600 leading-relaxed">
                                                        Bu modül aktif olduğunda, muayene sayfasındaki <strong>Öykü</strong> bölümünde ED Formu ve IIEF-EF değerlendirme butonu görünür.
                                                        Pasif olduğunda bu araçlar gizlenir.
                                                    </p>
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
                                                        🔍 IIEF-EF Skoru
                                                    </div>
                                                    <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
                                                        📋 ED Değerlendirme Formu
                                                    </div>
                                                    <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
                                                        💊 ED İlaç Veritabanı
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : activeDefinition === 'Doktorlar' ? (
                                        <DoctorsSettings
                                            items={definitions['Doktorlar'] || []}
                                            onChange={(newItems) => {
                                                const newState = { ...definitions, ['Doktorlar']: newItems };
                                                setDefinitions(newState);

                                                const dbState: Record<string, string[]> = {};
                                                Object.keys(newState).forEach(k => {
                                                    const list = (newState as any)[k] as any[];
                                                    dbState[k] = list.map(item => typeof item === 'object' ? item.value : item);
                                                });

                                                updateSettingsMutation.mutate([
                                                    { key: 'system_definitions', value: JSON.stringify(dbState) }
                                                ]);
                                            }}
                                        />
                                    ) : activeDefinition === 'Reçete Şablonları' ? (
                                        <PrescriptionTemplateSettings
                                            items={definitions['Reçete Şablonları'] || []}
                                            onChange={(newItems) => {
                                                const newState = { ...definitions, ['Reçete Şablonları']: newItems };
                                                setDefinitions(newState);

                                                const dbState: Record<string, string[]> = {};
                                                Object.keys(newState).forEach(k => {
                                                    const list = (newState as any)[k] as any[];
                                                    dbState[k] = list.map(item => typeof item === 'object' ? item.value : item);
                                                });

                                                updateSettingsMutation.mutate([
                                                    { key: 'system_definitions', value: JSON.stringify(dbState) }
                                                ]);
                                            }}
                                        />
                                    ) : activeDefinition === 'İlaç Listesi' ? (
                                        <DrugsSettings />
                                    ) : activeDefinition === 'ICD-10 Tanıları' ? (
                                        <div className="space-y-6">
                                            {/* Compact Single Entry */}
                                            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                                <Label className="text-[10px] font-bold text-blue-800 uppercase mb-2 block">Yeni Tanı Ekle</Label>
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-[2] space-y-1">
                                                        <Input
                                                            value={newICD.kodu}
                                                            onChange={(e) => setNewICD({ ...newICD, kodu: e.target.value.toUpperCase() })}
                                                            placeholder="Kod (N40)"
                                                            className="h-8 text-xs bg-white"
                                                        />
                                                    </div>
                                                    <div className="flex-[6] space-y-1">
                                                        <Input
                                                            value={newICD.adi}
                                                            onChange={(e) => setNewICD({ ...newICD, adi: e.target.value })}
                                                            placeholder="Tanı Adı"
                                                            className="h-8 text-xs bg-white"
                                                        />
                                                    </div>
                                                    <Button onClick={handleCreateICD} size="sm" className="h-8 bg-blue-600 px-4">
                                                        <Plus className="h-4 w-4 mr-1" /> EKLE
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Mass Import Interface */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Toplu Aktarım (Kopyala/Yapıştır)</Label>
                                                    <span className="text-[10px] text-slate-400">Format: KOD TANI_ADI (Satır satır)</span>
                                                </div>
                                                <Textarea
                                                    value={massIcdText}
                                                    onChange={(e) => setMassIcdText(e.target.value)}
                                                    placeholder="N40.1 Prostat Hiperplazisi&#10;N20.0 Böbrek Taşı&#10;..."
                                                    rows={4}
                                                    className="text-xs font-mono bg-slate-50 focus:bg-white resize-none"
                                                />
                                                <Button
                                                    onClick={handleMassImport}
                                                    variant="secondary"
                                                    size="sm"
                                                    className="w-full text-xs font-bold"
                                                    disabled={isMassImporting || !massIcdText.trim()}
                                                >
                                                    {isMassImporting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Upload className="h-3 w-3 mr-2" />}
                                                    TOPLU İÇE AKTAR
                                                </Button>
                                            </div>

                                            <Separator />

                                            {/* Search and List */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative flex-1">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                                        <Input
                                                            value={icdSearch}
                                                            onChange={(e) => handleSearchICD(e.target.value)}
                                                            placeholder="ICD Kodu veya Tanı adı ile arayın..."
                                                            className="pl-8 h-8 text-xs bg-white"
                                                        />
                                                    </div>
                                                    {selectedIcdIds.length > 0 && (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="h-8 text-xs px-3 bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                                                            onClick={handleBatchDeleteICD}
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-1.5" />
                                                            Seçilenleri Sil ({selectedIcdIds.length})
                                                        </Button>
                                                    )}
                                                </div>

                                                <div className="rounded-md border border-slate-200 overflow-hidden">
                                                    <div className="grid grid-cols-12 gap-2 p-2 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                                                        <div className="col-span-1 flex items-center justify-center">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded border-slate-300"
                                                                checked={selectedIcdIds.length > 0 && selectedIcdIds.length === icdResults.length}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedIcdIds(icdResults.map((r: ICDTani) => r.id));
                                                                    } else {
                                                                        setSelectedIcdIds([]);
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="col-span-2">KOD</div>
                                                        <div className="col-span-9">TANI ADI</div>
                                                    </div>
                                                    <ScrollArea className="h-[350px]">
                                                        <div className="divide-y divide-slate-100">
                                                            {isICDLoading && icdResults.length === 0 ? (
                                                                <div className="p-4 text-center text-slate-400 text-[10px] flex items-center justify-center gap-2">
                                                                    <Loader2 className="h-3 w-3 animate-spin" /> Yükleniyor...
                                                                </div>
                                                            ) : icdResults.length === 0 ? (
                                                                <div className="p-8 text-center text-slate-400 text-[10px]">
                                                                    Sonuç bulunamadı
                                                                </div>
                                                            ) : (
                                                                icdResults.map((item: ICDTani) => (
                                                                    <div
                                                                        key={item.id}
                                                                        className={cn(
                                                                            "grid grid-cols-12 gap-2 p-2 items-center hover:bg-slate-50 transition-colors cursor-pointer",
                                                                            selectedIcdIds.includes(item.id) && "bg-blue-50/50"
                                                                        )}
                                                                        onClick={() => toggleIcdSelection(item.id)}
                                                                    >
                                                                        <div className="col-span-1 flex items-center justify-center">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="rounded border-slate-300"
                                                                                checked={selectedIcdIds.includes(item.id)}
                                                                                onChange={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleIcdSelection(item.id);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="col-span-2 font-bold text-[10px] text-blue-600">{item.kodu}</div>
                                                                        <div className="col-span-9 text-[10px] text-slate-700 font-medium truncate">{item.adi}</div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{activeDefinition}</h3>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        className="h-8 bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold text-[10px]"
                                                        onClick={handleAddDefinition}
                                                    >
                                                        <Plus className="h-3 w-3" /> YENİ EKLE
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={handleSaveDefinitions}
                                                        className="h-8 bg-green-600 hover:bg-green-700 text-white gap-2 font-bold text-[10px]"
                                                    >
                                                        <Save className="h-3 w-3" /> DEĞİŞİKLİKLERİ KAYDET
                                                    </Button>
                                                </div>
                                            </div>

                                            <ScrollArea className="h-[500px] border rounded-xl bg-slate-50/30">
                                                <div className="p-4 space-y-2">
                                                    <DndContext
                                                        sensors={sensors}
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={handleDragEnd}
                                                        modifiers={[restrictToVerticalAxis]}
                                                    >
                                                        <SortableContext
                                                            items={definitions[activeDefinition]?.map(item => item.id) || []}
                                                            strategy={verticalListSortingStrategy}
                                                        >
                                                            {activeDefinition === 'Ameliyat Not Şablonları' || activeDefinition === 'Tıbbi Müdahale Şablonları' ? (
                                                                definitions[activeDefinition]?.map((item, index) => {
                                                                    const parts = item.value.split('|');
                                                                    const rawName = parts[0] || "";
                                                                    const rawNote = parts[1] || "";
                                                                    const titleLabel = activeDefinition === 'Tıbbi Müdahale Şablonları' ? "İŞLEM BAŞLIĞI" : "AMELİYAT ADI";
                                                                    const contentLabel = activeDefinition === 'Tıbbi Müdahale Şablonları' ? "MÜDAHALE DETAYI VE ŞABLON" : "AMELİYAT NOTU ŞABLONU";

                                                                    return (
                                                                        <SortableItem key={item.id} id={item.id}>
                                                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 relative group">
                                                                                <button
                                                                                    onClick={() => handleDeleteDefinition(index)}
                                                                                    className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors p-1"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </button>
                                                                                <div className="space-y-1">
                                                                                    <Label className="text-[10px] font-bold text-slate-400">{titleLabel}</Label>
                                                                                    <Input
                                                                                        value={rawName}
                                                                                        onChange={(e) => {
                                                                                            const newName = e.target.value;
                                                                                            handleDefinitionChange(index, `${newName}|${rawNote}`);
                                                                                        }}
                                                                                        className="h-8 text-xs font-bold text-slate-700 border-0 bg-slate-50 focus-visible:ring-1"
                                                                                        placeholder={`${titleLabel} girin...`}
                                                                                    />
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <Label className="text-[10px] font-bold text-slate-400">{contentLabel}</Label>
                                                                                    <Textarea
                                                                                        value={rawNote}
                                                                                        onChange={(e) => {
                                                                                            const newNote = e.target.value;
                                                                                            handleDefinitionChange(index, `${rawName}|${newNote}`);
                                                                                        }}
                                                                                        className="text-xs text-slate-600 border-0 bg-slate-50 focus-visible:ring-1 min-h-[80px]"
                                                                                        placeholder="Şablon içeriğini girin..."
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </SortableItem>
                                                                    );
                                                                })
                                                            ) : activeDefinition === 'Ameliyat Ekibi' ? (
                                                                definitions[activeDefinition]?.map((item, index) => {
                                                                    const parts = item.value.split('|');
                                                                    const role = parts[0]?.trim() || "Cerrah";
                                                                    const name = parts[1] || "";
                                                                    return (
                                                                        <SortableItem key={item.id} id={item.id}>
                                                                            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm group">
                                                                                <div className="w-32 shrink-0">
                                                                                    <select
                                                                                        value={role}
                                                                                        onChange={(e) => handleDefinitionChange(index, `${e.target.value}|${name}`)}
                                                                                        className="w-full h-8 text-[10px] font-bold bg-slate-100 border-none rounded-md px-2 focus:ring-1"
                                                                                    >
                                                                                        <option value="Cerrah">CERRAH</option>
                                                                                        <option value="Asistan">ASİSTAN</option>
                                                                                        <option value="Hemşire">HEMŞİRE</option>
                                                                                        <option value="Anestezi">ANESTEZİ</option>
                                                                                        <option value="Teknisyen">TEKNİSYEN</option>
                                                                                    </select>
                                                                                </div>
                                                                                <Input
                                                                                    value={name}
                                                                                    onChange={(e) => handleDefinitionChange(index, `${role}|${e.target.value}`)}
                                                                                    className="h-8 border-0 focus-visible:ring-0 text-sm font-medium text-slate-700 bg-slate-50/50"
                                                                                    placeholder="İsim soyisim..."
                                                                                />
                                                                                <button
                                                                                    onClick={() => handleDeleteDefinition(index)}
                                                                                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </button>
                                                                            </div>
                                                                        </SortableItem>
                                                                    );
                                                                })
                                                            ) : activeDefinition === 'TRUS Biyopsi Şablonu' ? (
                                                                definitions[activeDefinition]?.map((item, index) => {
                                                                    const parts = item.value.split('|');
                                                                    const num = parts[0]?.trim() || "";
                                                                    const loc = parts[1]?.trim() || "";
                                                                    return (
                                                                        <SortableItem key={item.id} id={item.id}>
                                                                            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm group">
                                                                                <div className="w-16 shrink-0">
                                                                                    <div className="text-[10px] font-bold text-slate-400 mb-0.5 ml-1">NO</div>
                                                                                    <Input
                                                                                        value={num}
                                                                                        onChange={(e) => handleDefinitionChange(index, `${e.target.value}|${loc}`)}
                                                                                        className="h-8 border-slate-200 text-sm font-bold text-center"
                                                                                        placeholder="#"
                                                                                    />
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <div className="text-[10px] font-bold text-slate-400 mb-0.5 ml-1">LOKASYON</div>
                                                                                    <Input
                                                                                        value={loc}
                                                                                        onChange={(e) => handleDefinitionChange(index, `${num}|${e.target.value}`)}
                                                                                        className="h-8 border-slate-200 text-sm font-medium"
                                                                                        placeholder="Biyopsi alınan bölge..."
                                                                                    />
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleDeleteDefinition(index)}
                                                                                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-full mt-4"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </button>
                                                                            </div>
                                                                        </SortableItem>
                                                                    );
                                                                })
                                                            ) : activeDefinition === 'Randevu Türleri' ? (
                                                                definitions[activeDefinition]?.map((item, index) => (
                                                                    <AppointmentTypeRow
                                                                        key={item.id}
                                                                        item={item}
                                                                        index={index}
                                                                        onChange={(idx, newVal) => handleDefinitionChange(idx, newVal)}
                                                                        onDelete={(idx) => handleDeleteDefinition(idx)}
                                                                    />
                                                                ))
                                                            ) : (
                                                                definitions[activeDefinition]?.map((item, index) => (
                                                                    <SortableItem key={item.id} id={item.id}>
                                                                        <div className="flex items-center gap-2 bg-white p-1 pr-3 rounded-lg border border-slate-200 shadow-sm group">
                                                                            <Input
                                                                                value={item.value}
                                                                                onChange={(e) => handleDefinitionChange(index, e.target.value)}
                                                                                className="h-8 border-0 focus-visible:ring-0 text-sm font-medium text-slate-700"
                                                                            />
                                                                            <button
                                                                                onClick={() => handleDeleteDefinition(index)}
                                                                                className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </button>
                                                                        </div>
                                                                    </SortableItem>
                                                                ))
                                                            )}
                                                        </SortableContext>
                                                    </DndContext>
                                                    {definitions[activeDefinition]?.length === 0 && (
                                                        <div className="text-center py-12 text-slate-400">
                                                            <p className="text-sm">Henüz kayıt bulunmuyor.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>



                    <TabsContent value="audit">
                        <AuditLogsSettings />
                    </TabsContent>

                    <TabsContent value="integrations">
                        <IntegrationsSettings />
                    </TabsContent>

                </Tabs>
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kullanıcıyı Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu kullanıcıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve kullanıcının tüm yetkileri iptal edilecektir.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleteUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kullanıcıyı Sil"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
