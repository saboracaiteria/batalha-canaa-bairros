import * as THREE from 'three';

/**
 * Weapon - Defines weapon stats and behavior
 */
export class Weapon {
    constructor(type = 'AR') {
        this.type = type;
        this.config = this.getConfig(type);
        this.ammo = this.config.magSize;
        this.reserveAmmo = this.config.maxAmmo;
        this.lastShot = 0;
        this.isReloading = false;
    }

    /**
     * Get weapon configuration
     */
    getConfig(type) {
        const configs = {
            'AR': {
                name: 'Assault Rifle',
                damage: 25,
                fireRate: 120,
                magSize: 30,
                maxAmmo: 180,
                reloadTime: 2000,
                bulletSpeed: 5,
                adsFov: 30,
                accuracy: 0.98
            },
            'SNIPER': {
                name: 'Sniper Rifle',
                damage: 75,
                fireRate: 1200,
                magSize: 5,
                maxAmmo: 25,
                reloadTime: 3000,
                bulletSpeed: 8,
                adsFov: 12,
                accuracy: 0.995
            },
            'SMG': {
                name: 'Submachine Gun',
                damage: 20,
                fireRate: 80,
                magSize: 40,
                maxAmmo: 200,
                reloadTime: 1500,
                bulletSpeed: 4,
                adsFov: 35,
                accuracy: 0.95
            },
            'SHOTGUN': {
                name: 'Shotgun',
                damage: 15,
                fireRate: 600,
                magSize: 8,
                maxAmmo: 40,
                reloadTime: 2500,
                bulletSpeed: 3,
                adsFov: 40,
                accuracy: 0.85,
                pellets: 8
            }
        };

        return configs[type] || configs['AR'];
    }

    /**
     * Can shoot?
     */
    canShoot(currentTime) {
        if (this.isReloading || this.ammo <= 0) return false;
        return currentTime - this.lastShot >= this.config.fireRate;
    }

    /**
     * Shoot weapon
     */
    shoot(currentTime) {
        if (!this.canShoot(currentTime)) return false;

        this.lastShot = currentTime;
        this.ammo--;
        return true;
    }

    /**
     * Reload weapon
     */
    reload() {
        if (this.isReloading || this.ammo === this.config.magSize || this.reserveAmmo <= 0) {
            return false;
        }

        this.isReloading = true;

        setTimeout(() => {
            const needed = this.config.magSize - this.ammo;
            const toReload = Math.min(needed, this.reserveAmmo);
            this.ammo += toReload;
            this.reserveAmmo -= toReload;
            this.isReloading = false;
        }, this.config.reloadTime);

        return true;
    }

    /**
     * Add ammo
     */
    addAmmo(amount) {
        this.reserveAmmo = Math.min(
            this.config.maxAmmo,
            this.reserveAmmo + amount
        );
    }

    /**
     * Get weapon stats
     */
    getStats() {
        return {
            type: this.type,
            name: this.config.name,
            ammo: this.ammo,
            reserveAmmo: this.reserveAmmo,
            magSize: this.config.magSize,
            isReloading: this.isReloading
        };
    }
}

/**
 * WeaponManager - Manages player's weapons and switching
 */
export class WeaponManager {
    constructor() {
        this.weapons = {
            'AR': new Weapon('AR'),
            'SNIPER': new Weapon('SNIPER'),
            'SMG': new Weapon('SMG'),
            'SHOTGUN': new Weapon('SHOTGUN')
        };

        this.currentWeapon = 'AR';
        this.switchCooldown = 0;
    }

    /**
     * Get current weapon
     */
    getCurrent() {
        return this.weapons[this.currentWeapon];
    }

    /**
     * Switch weapon
     */
    switchTo(weaponType) {
        if (this.weapons[weaponType] && this.switchCooldown <= 0) {
            this.currentWeapon = weaponType;
            this.switchCooldown = 500; // 500ms cooldown

            setTimeout(() => {
                this.switchCooldown = 0;
            }, 500);

            return true;
        }
        return false;
    }

    /**
     * Shoot current weapon
     */
    shoot(currentTime) {
        return this.getCurrent().shoot(currentTime);
    }

    /**
     * Reload current weapon
     */
    reload() {
        return this.getCurrent().reload();
    }

    /**
     * Get ADS FOV for current weapon
     */
    getAdsFov() {
        return this.getCurrent().config.adsFov;
    }

    /**
     * Get bullet speed for current weapon
     */
    getBulletSpeed() {
        return this.getCurrent().config.bulletSpeed;
    }

    /**
     * Get damage for current weapon
     */
    getDamage() {
        return this.getCurrent().config.damage;
    }

    /**
     * Get accuracy for current weapon
     */
    getAccuracy() {
        return this.getCurrent().config.accuracy;
    }

    /**
     * Has ammo?
     */
    hasAmmo() {
        const weapon = this.getCurrent();
        return weapon.ammo > 0 || weapon.reserveAmmo > 0;
    }
}
