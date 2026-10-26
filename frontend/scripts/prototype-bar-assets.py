# PROTOTYPE（票 08，prototype/bar 分支）：把原版提取目录里的图补回逻辑尺寸（票 03 笔记 5.1 节的偏移），
# 拷进 public/prototype-bar/。音频也拷，但只在本机（.git/info/exclude 排除，不进仓库，ADR-0003）。
#   uv run --with pillow python scripts/prototype-bar-assets.py
import shutil
import sys
from pathlib import Path

from PIL import Image

SRC = Path(r"E:\Download\others\VA11_extract")
OUT = Path(__file__).resolve().parent.parent / "public" / "prototype-bar"

# 文件名 → (输出名, 逻辑宽, 逻辑高, 偏移 x, 偏移 y)；没写的照原样拷。
PAD = {
    "102_ctc_{i:02d}.png": ("ctc_{i}", 15, 15, 3, 3, range(8)),
    "072_icesprite.png": ("ice", 33, 57, 3, 23, None),
    "071_agesprite.png": ("age", 33, 57, 4, 25, None),
    "044_shaker_spr.png": ("shaker", 72, 68, 20, 6, None),
    "047_shake_hover_spr.png": ("shaker_hover", 72, 68, 20, 3, None),
    "046_shaker_nohit.png": ("shaker_shake", 72, 68, 20, 6, None),
    "073_resetsprite.png": ("reset", 71, 25, 1, 1, None),
    "074_resetsprite_hover.png": ("reset_hover", 71, 25, 1, 1, None),
    "075_mixspriteno.png": ("mix_no", 71, 25, 1, 1, None),
    "076_mixspriteno_hover.png": ("mix_no_hover", 71, 25, 1, 1, None),
    "077_mixspriteyes.png": ("mix_yes", 71, 25, 1, 1, None),
    "078_mixspriteyes_hover.png": ("mix_yes_hover", 71, 25, 1, 1, None),
    "079_slotsprite.png": ("slot", 71, 25, 1, 1, None),
    "081_slotdone.png": ("slot_done", 71, 25, 1, 1, None),
    "083_slotoff.png": ("slot_off", 71, 25, 2, 1, None),
    "085_slotout.png": ("slot_out", 71, 25, 2, 1, None),
    "063_abig_on.png": ("big_a", 8, 17, 2, 2, None),
    "064_bbig_on.png": ("big_b", 8, 17, 2, 2, None),
    "065_cbig_on.png": ("big_d", 8, 17, 2, 2, None),
    "066_dbig_on.png": ("big_f", 8, 17, 2, 2, None),
    "067_ebig_on.png": ("big_k", 8, 17, 2, 2, None),
    "068_slot_n.png": ("gauge_on", 10, 5, 0, 0, None),
    "069_slot_b.png": ("gauge_big", 10, 5, 3, 2, None),
    "070_marcodefault.png": ("gauge", 70, 17, 0, 1, None),
    # 点唱机：小播放器的高亮按钮是整块 188x63 上的一小块，补回偏移
    "692_shuffle_small_spr.png": ("juke_shuffle", 188, 63, 107, 22, None),
    "694_backmusic_small_spr.png": ("juke_back", 188, 63, 7, 26, None),
    "695_loop_small_spr.png": ("juke_loop", 188, 63, 144, 25, None),
    "696_nextmusic_small_spr.png": ("juke_next", 188, 63, 66, 26, None),
    "057_successtext_cn_00.png": ("success", 59, 12, 12, 0, None),
    "055_failtext_cn_00.png": ("fail", 102, 15, 0, 3, None),
    "020_sugar_sush_spr.png": ("drink_srush", 35, 53, 11, 15, None),
    "037_mercuryblast_spr.png": ("drink_meblast", 35, 53, 11, 15, None),
    "021_sparkle_star_spr.png": ("drink_sstar", 35, 53, 7, 5, None),
    "023_fluffy_dream_spr.png": ("drink_fdream", 35, 53, 5, 5, None),
    "024_sunshine_cloud_spr.png": ("drink_scloud", 35, 53, 6, 6, None),
    "040_zen_star_spr.png": ("drink_zstar", 35, 53, 6, 6, None),
    "026_gut_punch_spr.png": ("drink_gpunch", 35, 53, 6, 17, None),
    "031_beer_spr.png": ("drink_beer", 35, 53, 3, 4, None),
    "043_glitchbottle.png": ("drink_glitch", 35, 53, 3, 9, None),
    "182_abs_spr.png": ("drink_abs", 35, 53, 7, 11, None),  # 瓶装 25x40 +(2,5)，原点 12,20 挪到 17,26
    "181_rum_spr.png": ("drink_rum", 35, 53, 7, 9, None),
    "180_tea_spr.png": ("drink_tea", 35, 53, 12, 6, None),
    "183_fed_spr.png": ("drink_fed", 35, 53, 6, 20, None),
}

COPY = {
    "000_frame_sprite.png": "frame",
    "002_barground.png": "barground",
    "141_fan_spr.png": "fan",
    "139_scanrines.png": "scanlines",
    "166_recipe_introcn.png": "recipe_intro",
    "172_recipe_bg.png": "recipe_bg",
    "617_shop_arrow_spr.png": "arrow",
    "004_adelhyde.png": "ing_a",
    "007_bronson.png": "ing_b",
    "010_delta.png": "ing_d",
    "013_flanergide.png": "ing_f",
    "016_karmotrine.png": "ing_k",
    "005_adelhyde_hover.png": "ing_a_hover",
    "008_bronson_hover.png": "ing_b_hover",
    "011_delta_hover.png": "ing_d_hover",
    "014_flanergide_hover.png": "ing_f_hover",
    "017_karmotrine_hover.png": "ing_k_hover",
    "006_adelhyde_off.png": "ing_a_off",
    "009_bronson_off.png": "ing_b_off",
    "012_delta_off.png": "ing_d_off",
    "015_flanergide_off.png": "ing_f_off",
    "018_karmotrine_off.png": "ing_k_off",
    "058_a_on.png": "cell_a",
    "059_b_on.png": "cell_b",
    "060_c_on.png": "cell_d",
    "061_d_on.png": "cell_f",
    "062_e_on.png": "cell_k",
    "049_shakerpulse_red.png": "pulse_a",
    "050_shakerpulse_yellow.png": "pulse_b",
    "051_shakerpulse_blue.png": "pulse_d",
    "052_shakerpulse_green.png": "pulse_f",
    "053_shakerpulse_cyan.png": "pulse_k",
    "048_shakerpulse_white.png": "pulse_white",
    "022_blue_fairy_spr.png": "drink_bfairy",
    "025_moonblast_spr.png": "drink_moblast",
    "027_piledriver_spr.png": "drink_pdriver",
    "028_suplex_spr.png": "drink_splex",
    "029_marsblast_spr.png": "drink_mablast",
    "030_crevice_spike_spr.png": "drink_cspike",
    "032_bleeding_jane_spr.png": "drink_bjane",
    "033_badtouch_spr.png": "drink_btouch",
    "034_brandtini_spr.png": "drink_btini",
    "035_cobalt_velvet_spr.png": "drink_cvelvet",
    "036_fringe_weaver_spr.png": "drink_fweaver",
    "038_grizzly_temple_spr.png": "drink_gtemple",
    "039_bloom_light_spr.png": "drink_blight",
    "041_piano_man_spr.png": "drink_pman",
    "042_piano_woman_spr.png": "drink_pwman",
}
for i in range(6):
    COPY[f"148_news_channel_spr_{i:02d}.png"] = f"tv_{i}"
for i in range(3):
    COPY[f"495_barintro_spr_{i:02d}.png"] = f"intro_{i}"
# 电视的频道（bg_tv：点一下换台，共 10 台，第 10 台是关着）
CHANNELS = {"145_burrito": 3, "146_wk": 7, "147_dollar": 2, "148_news": 6, "150_yiik": 3, "151_toku": 3, "152_mwj": 4, "154_ramen": 3, "155_wrestle": 2}
for prefix, frames in CHANNELS.items():
    name = prefix.split("_", 1)[1]
    for i in range(frames):
        COPY[f"{prefix}_channel_spr_{i:02d}.png"] = f"ch_{name}_{i}"
COPY["153_hassy_channel_spr.png"] = "ch_hassy_0"
for i in range(25):
    COPY[f"170_recipes_cn_{i:02d}.png"] = f"recipe_{i}"
# 点唱机选曲界面和小播放器
COPY.update({
    "699_new_jukeframe.png": "juke_frame",
    "698_startup_juke.png": "juke_startup",
    "620_musicslot_spr.png": "juke_slot_blue",
    "621_playlistslot_spr.png": "juke_slot_red",
    "622_playlistslotselect_spr.png": "juke_slot_yellow",
    "701_ready_red.png": "juke_ready_red",
    "702_ready_green.png": "juke_ready_green",
    "691_small_jukebox_spr.png": "juke_small_paused",
    "697_small_jukebox_pause_spr.png": "juke_small_playing",
})
for i in range(4):
    COPY[f"717_previewload_spr_{i:02d}.png"] = f"juke_preview_{i}"
# 加料的光圈也是 72x68 +(20,6)
PULSES = {"pulse_a", "pulse_b", "pulse_d", "pulse_f", "pulse_k", "pulse_white"}

AUDIO = {
    "080_addingredient.ogg": "add",
    "101_iceadd.ogg": "ice",
    "081_ageadd.ogg": "age",
    "109_mixdone.ogg": "mix",
    "099_glassserve.ogg": "serve",
    "088_buttonclick.ogg": "click",
    "089_buttonnoclick.ogg": "noclick",
    "083_bleep_high.ogg": "bleep_high",
    "085_bleep_low.ogg": "bleep_low",
    "086_boot_up.ogg": "boot",
    "106_jukeselect.ogg": "tab",
    "104_jukechange.ogg": "pick",
    "095_door.ogg": "door",
    "038_last_call.ogg": "bgm_last_call",
    "110_mouse_hover.ogg": "hover",
    "105_jukepick.ogg": "jukepick",
    "104_jukechange.ogg": "jukechange",
    "114_prompt.ogg": "prompt",
}
# 点唱机的 59 首（jukebox_list 的 fullplaylist），只拷到本机
SONGS = [
    "032_hopes_and_dreams", "002_a_neon_glow_lights_the_way", "072_welcome_to_valhalla", "022_every_day_is_night",
    "017_commencing_simulation", "020_drive_me_wild", "030_good_for_health_bad_for_education", "075_who_was_i",
    "067_troubling_news", "001_a_gaze_that_invited_disaster", "026_friendly_conversation", "079_youve_got_me",
    "069_umemoto", "036_jc_eltons", "029_go_go_streaming_chan", "006_all_systems_go", "074_where_do_i_go_from_here",
    "076_will_you_remember_me", "023_everything_will_be_okay", "040_march_of_the_white_knights", "004_a_rene",
    "048_safe_haven", "043_neo_avatar", "063_those_who_dwell_in_the_shadows", "045_nightime_maneuvers",
    "005_a_star_pierces_the_darkness", "078_your_love_is_a_drug", "064_through_the_storm_we_will_find_a_way",
    "058_synthestitch", "053_snowfall", "060_the_answer_lies_within", "018_dawn_approaches",
    "077_with_renewed_hope_we_continue_forward", "038_last_call", "047_reminescence",
    "013_believe_in_me_who_believes_in_you", "019_digital_drive", "062_the_girl_with_the_iron_heart",
    "042_metropolis", "044_neon_district", "037_karmotrine_dream", "052_skyline", "003_a_new_frontier", "021_dusk",
    "041_meet_the_staff", "031_heart_of_the_city", "000_a_city_that_never_sleeps", "011_base_of_the_titans",
    "025_follow_the_trail", "046_out_of_orbit", "059_tense", "070_underground_club", "051_showtime",
    "008_an_alternate_reality", "061_the_assignment", "068_truth", "028_glitch_city", "054_snowfall_remix",
    "012_base_of_titans_remix",
]


def pad(src: Path, w: int, h: int, x: int, y: int) -> Image.Image:
    img = Image.open(src).convert("RGBA")
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(img, (x, y))
    return canvas


# arrow_text_2：文本打完后右下角上下跳的倒三角，8x8，每帧的偏移不同
ARROW_OFFSETS = [(0, 1), (0, 2), (0, 1), (0, 0)]
# 鼠标（cursor_obj）：名字、逻辑尺寸、偏移；热点在组件里按倍数算
CURSORS = {
    "159_cursor_spr.png": ("spr", 17, 24, 0, 0),
    "163_cursor_clicked.png": ("clicked", 17, 24, 0, 1),
    "160_cursor_open.png": ("open", 17, 25, 0, 0),
    "161_cursor_closed.png": ("closed", 17, 21, 0, 0),
}
for i in range(4):
    CURSORS[f"164_cursor_next_{i:02d}.png"] = (f"next_{i}", 32, 20, 0, 0)


def main() -> None:
    (OUT / "img").mkdir(parents=True, exist_ok=True)
    (OUT / "audio").mkdir(parents=True, exist_ok=True)
    sprites = SRC / "sprites"
    for pattern, (name, w, h, x, y, frames) in PAD.items():
        for i in frames if frames is not None else [None]:
            src = sprites / (pattern.format(i=i) if i is not None else pattern)
            out = name.format(i=i) if i is not None else name
            pad(src, w, h, x, y).save(OUT / "img" / f"{out}.png")
    for file, name in COPY.items():
        if name in PULSES:
            pad(sprites / file, 72, 68, 20, 6).save(OUT / "img" / f"{name}.png")
        else:
            shutil.copyfile(sprites / file, OUT / "img" / f"{name}.png")
    for i, (ox, oy) in enumerate(ARROW_OFFSETS):
        pad(sprites / f"138_arrow_text_2_{i:02d}.png", 8, 8, ox, oy).save(OUT / "img" / f"arrow_{i}.png")
    for file, (name, w, h, ox, oy) in CURSORS.items():
        base = pad(sprites / file, w, h, ox, oy)
        for k in (1, 2, 3):
            base.resize((w * k, h * k), Image.NEAREST).save(OUT / "img" / f"cur_{name}@{k}.png")
    for file, name in AUDIO.items():
        shutil.copyfile(SRC / "audio" / file, OUT / "audio" / f"{name}.ogg")
    (OUT / "audio" / "songs").mkdir(exist_ok=True)
    for i, song in enumerate(SONGS):
        target = OUT / "audio" / "songs" / f"{i}.ogg"
        if not target.exists():
            shutil.copyfile(SRC / "audio" / f"{song}.ogg", target)
    print("ok", len(list((OUT / "img").iterdir())), "images", file=sys.stderr)


main()
