import { load } from 'cheerio';

interface RoomIdResult {
    success: boolean;
    roomId: string;
    channelId: string; // El ID único del usuario/canal
}

/**
 * Obtiene el roomId y channelId de un live activo.
 */
export async function getRoomId(username: string): Promise<RoomIdResult> {
    const user = username.replace(/^@/, '');
    const url = `https://www.tiktok.com/@${user}/live`;

    try {
        const res = await fetch(url, {
            headers: {
                // El User-Agent es crítico para que TikTok devuelva el JSON de estado
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        // 1. Detección por redirección (si no está en live, TikTok suele mandar al perfil)
        if (res.redirected && !res.url.includes('/live')) {
            return { success: false, roomId: '', channelId: '' };
        }

        const html = await res.text();
        const $ = load(html);

        // 2. Extracción mediante JSON de estado (Método más confiable)
        const scriptData = $('#SIGI_STATE').html() || $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html();
        
        if (scriptData) {
            try {
                const json = JSON.parse(scriptData);
                
                // Estructura para SIGI_STATE (Escritorio)
                const liveRoom = json.LiveRoom?.liveRoomUserInfo;
                if (liveRoom) {
                    return {
                        success: liveRoom.user.status === 2, // 2 suele indicar "en vivo"
                        roomId: liveRoom.user.roomId || '',
                        channelId: liveRoom.user.id || ''
                    };
                }
            } catch (e) {
                console.error("Error parseando JSON de TikTok");
            }
        }

        // 3. Fallback: Meta Tags (Para el channelId y roomId)
        const roomId = 
            $('meta[property="al:android:url"]').attr('content')?.match(/room_id=(\d+)/)?.[1] ||
            $('meta[property="og:url"]').attr('content')?.match(/\/live\/(\d+)/)?.[1] || '';

        // El channelId suele estar en la URL de la tienda o en el meta de twitter
        const channelId = 
            $('meta[name="twitter:app:url:iphone"]').attr('content')?.match(/user\/(\d+)/)?.[1] || 
            $('meta[property="al:ios:url"]').attr('content')?.match(/user\/(\d+)/)?.[1] || '';

        return {
            success: roomId !== '',
            roomId,
            channelId
        };

    } catch (error) {
        console.error("Error en getRoomId:", error);
        return { success: false, roomId: '', channelId: '' };
    }
}