require.config({
	'paths': {
		//'jquery': 'https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min'
	}
});

define(['bind','bench/mainapp'],function(bind, mainapp){
	var instance = mainapp.instance();
	bind.bind('.main', instance);
	instance.initialize();
});
