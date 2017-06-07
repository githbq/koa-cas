> 项目描述

![my love](./logo.png) 


### 用法

```javascript
    const CAS = require('koa-cas');
    const cas = new CAS({
        baseUrl: 'https://sso.xx.com:8888/sso', 
        service: 'http://localhost:3000/',
        secureSSL: false,
    });
```

Using it in a login route:

```javascript
    exports.casLogin = function * () {
        let ticket = this.params.ticket;
        
        if(!ticket){
            return this.redirect('/');
        }
        
        this.body = yield cas.validate(ticket);
    };
```
 
